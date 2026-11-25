import { supabase } from './supabase';
import {
  fetchSeriesCatalog,
  type ChapterRecord,
  type SeriesRecord,
} from './library';
import { fetchPostById, type PostRecord } from './posts';

// =============================================================================
// 1. ENCUESTAS INTERACTIVAS EN COMUNIDAD (post_polls y poll_votes)
// =============================================================================

export type PollDurationOption = '24h' | '3d' | '7d' | 'none';

export const POLL_DURATION_OPTIONS: ReadonlyArray<{
  value: PollDurationOption;
  label: string;
}> = [
  { value: '24h', label: '24 horas' },
  { value: '3d', label: '3 días' },
  { value: '7d', label: '7 días' },
  { value: 'none', label: 'Sin límite' },
];

export interface PollOptionStat {
  index: number;
  label: string;
  votes: number;
  percentage: number;
}

export interface PostPollData {
  id: string;
  post_id: string;
  question: string;
  options: string[];
  ends_at: string | null;
  created_at: string;
  totalVotes: number;
  userVoteIndex: number | null;
  optionStats: PollOptionStat[];
  isClosed: boolean;
}

interface RawPollRow {
  id: string;
  post_id: string;
  question: string;
  options: unknown;
  ends_at: string | null;
  created_at: string;
}

interface RawPollVoteRow {
  poll_id: string;
  user_id: string;
  option_index: number;
}

export function computePollEndsAt(duration: PollDurationOption): string | null {
  if (duration === 'none') return null;
  const hours = duration === '24h' ? 24 : duration === '3d' ? 72 : 168;
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

function normalizePollOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (
          item &&
          typeof item === 'object' &&
          'label' in item &&
          typeof (item as { label?: unknown }).label === 'string'
        ) {
          return (item as { label: string }).label.trim();
        }
        return '';
      })
      .filter((s) => s.length > 0);
  }
  return [];
}

function buildPollData(
  row: RawPollRow,
  votes: RawPollVoteRow[],
  currentUserId?: string | null
): PostPollData {
  const options = normalizePollOptions(row.options);
  const counts = options.map(() => 0);
  let userVoteIndex: number | null = null;

  for (const vote of votes) {
    const idx = Number(vote.option_index);
    if (Number.isInteger(idx) && idx >= 0 && idx < counts.length) {
      counts[idx] += 1;
      if (currentUserId && vote.user_id === currentUserId) {
        userVoteIndex = idx;
      }
    }
  }

  const totalVotes = counts.reduce((sum, c) => sum + c, 0);
  const optionStats: PollOptionStat[] = options.map((label, index) => ({
    index,
    label,
    votes: counts[index],
    percentage:
      totalVotes > 0 ? Math.round((counts[index] / totalVotes) * 100) : 0,
  }));

  const isClosed =
    Boolean(row.ends_at) && new Date(row.ends_at as string).getTime() <= Date.now();

  return {
    id: row.id,
    post_id: row.post_id,
    question: row.question,
    options,
    ends_at: row.ends_at ?? null,
    created_at: row.created_at,
    totalVotes,
    userVoteIndex,
    optionStats,
    isClosed,
  };
}

export async function createPostPoll(params: {
  postId: string;
  question: string;
  options: string[];
  duration: PollDurationOption;
}): Promise<void> {
  const cleanQuestion = params.question.trim();
  const cleanOptions = params.options
    .map((o) => o.trim())
    .filter((o) => o.length > 0)
    .slice(0, 4);

  if (!cleanQuestion) {
    throw new Error('Escribe una pregunta para la encuesta.');
  }
  if (cleanOptions.length < 2) {
    throw new Error('La encuesta debe tener al menos 2 opciones válidas.');
  }

  const endsAt = computePollEndsAt(params.duration);

  const { error } = await supabase.from('post_polls').insert({
    post_id: params.postId,
    question: cleanQuestion,
    options: cleanOptions,
    ends_at: endsAt,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchPollsByPostIds(
  postIds: string[],
  currentUserId?: string | null
): Promise<Record<string, PostPollData>> {
  const uniqueIds = Array.from(new Set(postIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const { data: pollRows, error: pollsError } = await supabase
    .from('post_polls')
    .select('id, post_id, question, options, ends_at, created_at')
    .in('post_id', uniqueIds);

  if (pollsError) {
    throw new Error(pollsError.message);
  }

  const polls = (pollRows ?? []) as RawPollRow[];
  if (polls.length === 0) return {};

  const pollIds = polls.map((p) => p.id);
  const { data: voteRows, error: votesError } = await supabase
    .from('poll_votes')
    .select('poll_id, user_id, option_index')
    .in('poll_id', pollIds);

  if (votesError) {
    throw new Error(votesError.message);
  }

  const votesByPoll = new Map<string, RawPollVoteRow[]>();
  for (const vote of (voteRows ?? []) as RawPollVoteRow[]) {
    const list = votesByPoll.get(vote.poll_id) ?? [];
    list.push(vote);
    votesByPoll.set(vote.poll_id, list);
  }

  const result: Record<string, PostPollData> = {};
  for (const poll of polls) {
    result[poll.post_id] = buildPollData(
      poll,
      votesByPoll.get(poll.id) ?? [],
      currentUserId
    );
  }
  return result;
}

export async function fetchPollForPost(
  postId: string,
  currentUserId?: string | null
): Promise<PostPollData | null> {
  const map = await fetchPollsByPostIds([postId], currentUserId);
  return map[postId] ?? null;
}

export async function castPollVote(params: {
  pollId: string;
  userId: string;
  optionIndex: number;
}): Promise<void> {
  const { error: upsertError } = await supabase.from('poll_votes').upsert(
    {
      poll_id: params.pollId,
      user_id: params.userId,
      option_index: params.optionIndex,
    },
    { onConflict: 'poll_id,user_id' }
  );

  if (!upsertError) return;

  // Fallback si la tabla tiene política o índice diferente
  const { error: updateError, count } = await supabase
    .from('poll_votes')
    .update({ option_index: params.optionIndex }, { count: 'exact' })
    .eq('poll_id', params.pollId)
    .eq('user_id', params.userId);

  if (!updateError && (count ?? 0) > 0) return;

  const { error: insertError } = await supabase.from('poll_votes').insert({
    poll_id: params.pollId,
    user_id: params.userId,
    option_index: params.optionIndex,
  });

  if (insertError) {
    throw new Error(insertError.message || upsertError.message);
  }
}

export function formatPollTimeRemaining(endsAt: string | null): string {
  if (!endsAt) return 'Sin límite de tiempo';
  const diffMs = new Date(endsAt).getTime() - Date.now();
  if (diffMs <= 0) return 'Encuesta cerrada';
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) {
    return `Cierra en ${Math.max(1, diffMinutes)} min`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Cierra en ${diffHours} h`;
  }
  const diffDays = Math.ceil(diffHours / 24);
  return `Cierra en ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
}

// =============================================================================
// 2. HISTORIAL DE LECTURA (public.reading_history)
// =============================================================================

export interface ReadingHistoryItem {
  id: string;
  kind: 'post' | 'chapter';
  last_read_at: string;
  post_id: string | null;
  series_id: string | null;
  chapter_id: string | null;
  post?: PostRecord | null;
  series?: SeriesRecord | null;
  chapter?: Pick<ChapterRecord, 'id' | 'chapter_number' | 'title'> | null;
}

interface RawReadingHistoryRow {
  id: string;
  user_id: string;
  post_id: string | null;
  series_id: string | null;
  chapter_id: string | null;
  last_read_at: string;
}

export async function recordPostReadingHistory(
  userId: string,
  postId: string
): Promise<void> {
  if (!userId || !postId) return;
  const nowIso = new Date().toISOString();

  const { data: existing } = await supabase
    .from('reading_history')
    .select('id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .limit(1);

  const existingId = existing?.[0]?.id as string | undefined;
  if (existingId) {
    await supabase
      .from('reading_history')
      .update({ last_read_at: nowIso })
      .eq('id', existingId);
  } else {
    await supabase.from('reading_history').insert({
      user_id: userId,
      post_id: postId,
      series_id: null,
      chapter_id: null,
      last_read_at: nowIso,
    });
  }
}

export async function recordChapterReadingHistory(
  userId: string,
  seriesId: string,
  chapterId: string
): Promise<void> {
  if (!userId || !seriesId || !chapterId) return;
  const nowIso = new Date().toISOString();

  // Mantiene una entrada actualizada por obra apuntando al último capítulo leído
  const { data: existing } = await supabase
    .from('reading_history')
    .select('id')
    .eq('user_id', userId)
    .eq('series_id', seriesId)
    .limit(1);

  const existingId = existing?.[0]?.id as string | undefined;
  if (existingId) {
    await supabase
      .from('reading_history')
      .update({ chapter_id: chapterId, last_read_at: nowIso })
      .eq('id', existingId);
  } else {
    await supabase.from('reading_history').insert({
      user_id: userId,
      post_id: null,
      series_id: seriesId,
      chapter_id: chapterId,
      last_read_at: nowIso,
    });
  }
}

export async function fetchReadingHistory(
  userId: string,
  limit = 30
): Promise<ReadingHistoryItem[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('reading_history')
    .select('id, user_id, post_id, series_id, chapter_id, last_read_at')
    .eq('user_id', userId)
    .order('last_read_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as RawReadingHistoryRow[];
  if (rows.length === 0) return [];

  const postIds = Array.from(
    new Set(rows.map((r) => r.post_id).filter((id): id is string => Boolean(id)))
  );
  const seriesIds = Array.from(
    new Set(rows.map((r) => r.series_id).filter((id): id is string => Boolean(id)))
  );
  const chapterIds = Array.from(
    new Set(rows.map((r) => r.chapter_id).filter((id): id is string => Boolean(id)))
  );

  const [postsEntries, allSeries, chaptersRes] = await Promise.all([
    Promise.all(
      postIds.map(async (pid) => {
        try {
          const post = await fetchPostById(pid, userId);
          return [pid, post] as const;
        } catch {
          return [pid, null] as const;
        }
      })
    ),
    seriesIds.length > 0 ? fetchSeriesCatalog().catch(() => []) : Promise.resolve([]),
    chapterIds.length > 0
      ? supabase
          .from('chapters')
          .select('id, chapter_number, title')
          .in('id', chapterIds)
      : Promise.resolve({ data: [] as Array<{ id: string; chapter_number: number; title: string | null }> }),
  ]);

  const postMap = new Map<string, PostRecord | null>(postsEntries);
  const seriesMap = new Map<string, SeriesRecord>(allSeries.map((s) => [s.id, s]));
  const chapterMap = new Map<
    string,
    Pick<ChapterRecord, 'id' | 'chapter_number' | 'title'>
  >();
  for (const ch of (chaptersRes.data ?? []) as Array<{
    id: string;
    chapter_number: number | string;
    title: string | null;
  }>) {
    chapterMap.set(ch.id, {
      id: ch.id,
      chapter_number: Number(ch.chapter_number) || 0,
      title: ch.title ?? null,
    });
  }

  const hydrated: ReadingHistoryItem[] = [];
  for (const row of rows) {
    if (row.post_id) {
      const post = postMap.get(row.post_id) ?? null;
      if (!post) continue;
      hydrated.push({
        id: row.id,
        kind: 'post',
        last_read_at: row.last_read_at,
        post_id: row.post_id,
        series_id: null,
        chapter_id: null,
        post,
      });
    } else if (row.series_id) {
      const series = seriesMap.get(row.series_id) ?? null;
      if (!series) continue;
      const chapter = row.chapter_id ? chapterMap.get(row.chapter_id) ?? null : null;
      hydrated.push({
        id: row.id,
        kind: 'chapter',
        last_read_at: row.last_read_at,
        post_id: null,
        series_id: row.series_id,
        chapter_id: row.chapter_id,
        series,
        chapter,
      });
    }
  }

  return hydrated;
}

export async function clearReadingHistory(userId: string): Promise<void> {
  if (!userId) return;
  const { error } = await supabase
    .from('reading_history')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchReadingHistoryCount(userId: string): Promise<number> {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('reading_history')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) return 0;
  return count ?? 0;
}

// =============================================================================
// 3. RETOS DIARIOS DE ARCADE (Rotación determinista por fecha actual)
// =============================================================================

export type DailyChallengeGameId =
  | 'senda-astral'
  | 'bastion-de-runas'
  | 'pulso-neon'
  | 'codice-runico'
  | 'salto-vacio'
  | 'oraculo-trama';

export interface DailyArcadeChallenge {
  dateKey: string;
  dateLabel: string;
  gameId: DailyChallengeGameId;
  gameTitle: string;
  title: string;
  description: string;
  targetScore: number;
}

const DAILY_CHALLENGE_POOL: ReadonlyArray<{
  gameId: DailyChallengeGameId;
  gameTitle: string;
  title: string;
  description: string;
  targetScore: number;
}> = [
  {
    gameId: 'senda-astral',
    gameTitle: 'Senda Astral',
    title: 'Vuelo sin rasguños',
    description: 'Alcanza al menos 650 puntos en una partida de Senda Astral hoy.',
    targetScore: 650,
  },
  {
    gameId: 'pulso-neon',
    gameTitle: 'Pulso Neón',
    title: 'Frecuencia Perfecta',
    description: 'Mantén el ritmo y supera los 1,200 puntos en Pulso Neón hoy.',
    targetScore: 1200,
  },
  {
    gameId: 'bastion-de-runas',
    gameTitle: 'Bastión de Runas',
    title: 'Guardián del Bastión',
    description: 'Supera los 800 puntos defendiendo la arena en Bastión de Runas hoy.',
    targetScore: 800,
  },
  {
    gameId: 'codice-runico',
    gameTitle: 'Códice Rúnico',
    title: 'Memoria Arcana',
    description: 'Reproduce secuencias rúnicas hasta superar los 700 puntos en Códice Rúnico hoy.',
    targetScore: 700,
  },
  {
    gameId: 'salto-vacio',
    gameTitle: 'Salto del Vacío',
    title: 'Ascenso sin Límites',
    description: 'Escala las plataformas hasta lograr 900 puntos en Salto del Vacío hoy.',
    targetScore: 900,
  },
  {
    gameId: 'oraculo-trama',
    gameTitle: 'Oráculo de Trama',
    title: 'Mente Relámpago',
    description: 'Encadena respuestas correctas y alcanza 1,000 puntos en Oráculo de Trama hoy.',
    targetScore: 1000,
  },
  {
    gameId: 'senda-astral',
    gameTitle: 'Senda Astral',
    title: 'Cazador de Reliquias',
    description: 'Encadena runas hasta llegar a 1,000 puntos en Senda Astral hoy.',
    targetScore: 1000,
  },
  {
    gameId: 'pulso-neon',
    gameTitle: 'Pulso Neón',
    title: 'Pulso Imparable',
    description: 'Domina las ondas dobles y consigue 1,800 puntos en Pulso Neón hoy.',
    targetScore: 1800,
  },
  {
    gameId: 'codice-runico',
    gameTitle: 'Códice Rúnico',
    title: 'Maestro del Códice',
    description: 'Supera rondas avanzadas para lograr 1,100 puntos en Códice Rúnico hoy.',
    targetScore: 1100,
  },
  {
    gameId: 'salto-vacio',
    gameTitle: 'Salto del Vacío',
    title: 'Cima del Abismo',
    description: 'Supera los 1,350 puntos en una sola escalada de Salto del Vacío hoy.',
    targetScore: 1350,
  },
  {
    gameId: 'oraculo-trama',
    gameTitle: 'Oráculo de Trama',
    title: 'Sabiduría de Trama',
    description: 'Supera los 1,450 puntos en Trivia Relámpago de Oráculo de Trama hoy.',
    targetScore: 1450,
  },
  {
    gameId: 'bastion-de-runas',
    gameTitle: 'Bastión de Runas',
    title: 'Centinela Imparable',
    description: 'Logra 1,300 puntos enfrentando a la legión en Bastión de Runas hoy.',
    targetScore: 1300,
  },
];

export function getTodayLocalDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayStartIso(now = new Date()): string {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return start.toISOString();
}

export function getDailyArcadeChallenge(now = new Date()): DailyArcadeChallenge {
  const dateKey = getTodayLocalDateKey(now);
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  const template = DAILY_CHALLENGE_POOL[dayOfYear % DAILY_CHALLENGE_POOL.length];

  const dateLabel = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(now);

  return {
    dateKey,
    dateLabel: dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1),
    ...template,
  };
}

const DAILY_LOCAL_STORAGE_KEY = 'trama_daily_challenge_best_v1';

export function getLocalDailyChallengeBest(dateKey: string, gameId: string): number {
  try {
    const raw = window.localStorage.getItem(DAILY_LOCAL_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Record<string, number>;
    return Math.max(0, Number(parsed[`${dateKey}:${gameId}`]) || 0);
  } catch {
    return 0;
  }
}

export function saveLocalDailyChallengeBest(
  dateKey: string,
  gameId: string,
  score: number
): number {
  const clean = Math.max(0, Math.floor(score));
  const current = getLocalDailyChallengeBest(dateKey, gameId);
  const best = Math.max(current, clean);
  try {
    const raw = window.localStorage.getItem(DAILY_LOCAL_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    parsed[`${dateKey}:${gameId}`] = best;
    window.localStorage.setItem(DAILY_LOCAL_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignorar errores de almacenamiento local
  }
  return best;
}

// =============================================================================
// 4. LOGROS E INSIGNIAS DESBLOQUEABLES (public.user_achievements)
// =============================================================================

export type AchievementKey =
  | 'first_post'
  | 'first_comment'
  | 'bookworm_5'
  | 'arcade_rookie'
  | 'arcade_500'
  | 'arcade_1500'
  | 'daily_challenger'
  | 'social_5_followers';

export interface AchievementDefinition {
  key: AchievementKey;
  title: string;
  description: string;
  category: 'Comunidad' | 'Lectura' | 'Arcade' | 'Social';
  tier: 'bronze' | 'silver' | 'gold';
}

export const ACHIEVEMENT_CATALOG: ReadonlyArray<AchievementDefinition> = [
  {
    key: 'first_post',
    title: 'Primera publicación',
    description: 'Publica tu primer artículo o hilo en Trama.',
    category: 'Comunidad',
    tier: 'bronze',
  },
  {
    key: 'first_comment',
    title: 'Primer comentario',
    description: 'Participa por primera vez en una conversación.',
    category: 'Comunidad',
    tier: 'bronze',
  },
  {
    key: 'bookworm_5',
    title: 'Lector voraz',
    description: 'Acumula 5 lecturas en tu historial de Trama.',
    category: 'Lectura',
    tier: 'silver',
  },
  {
    key: 'arcade_rookie',
    title: 'Debut en Arcade',
    description: 'Completa tu primera partida en cualquier minijuego.',
    category: 'Arcade',
    tier: 'bronze',
  },
  {
    key: 'arcade_500',
    title: 'Chispa Arcana',
    description: 'Alcanza 500 puntos o más en una partida de Arcade.',
    category: 'Arcade',
    tier: 'silver',
  },
  {
    key: 'arcade_1500',
    title: 'Leyenda del Arcade',
    description: 'Supera los 1,500 puntos en una sola partida.',
    category: 'Arcade',
    tier: 'gold',
  },
  {
    key: 'daily_challenger',
    title: 'Reto Diario Superado',
    description: 'Completa el Reto del Día en Arcade.',
    category: 'Arcade',
    tier: 'gold',
  },
  {
    key: 'social_5_followers',
    title: 'Voz Influyente',
    description: 'Consigue al menos 5 seguidores en tu perfil.',
    category: 'Social',
    tier: 'gold',
  },
];

export const ACHIEVEMENT_BY_KEY: Record<AchievementKey, AchievementDefinition> =
  ACHIEVEMENT_CATALOG.reduce(
    (acc, def) => {
      acc[def.key] = def;
      return acc;
    },
    {} as Record<AchievementKey, AchievementDefinition>
  );

export interface UserAchievementRecord {
  id: string;
  user_id: string;
  achievement_key: AchievementKey;
  unlocked_at: string;
}

export async function fetchUserAchievements(
  userId: string
): Promise<UserAchievementRecord[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('user_achievements')
    .select('id, user_id, achievement_key, unlocked_at')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{
    id: string;
    user_id: string;
    achievement_key: string;
    unlocked_at: string;
  }>)
    .filter((row): row is UserAchievementRecord =>
      row.achievement_key in ACHIEVEMENT_BY_KEY
    )
    .map((row) => ({
      id: String(row.id),
      user_id: row.user_id,
      achievement_key: row.achievement_key,
      unlocked_at: row.unlocked_at,
    }));
}

export async function insertUserAchievement(
  userId: string,
  key: AchievementKey
): Promise<UserAchievementRecord | null> {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('user_achievements')
    .insert({
      user_id: userId,
      achievement_key: key,
    })
    .select('id, user_id, achievement_key, unlocked_at')
    .maybeSingle();

  if (error) {
    // 23505 = ya desbloqueado previamente
    if (error.code === '23505') return null;
    console.warn('No se pudo registrar logro:', key, error.message);
    return null;
  }

  if (!data) return null;
  return {
    id: String(data.id),
    user_id: data.user_id,
    achievement_key: data.achievement_key as AchievementKey,
    unlocked_at: data.unlocked_at,
  };
}
