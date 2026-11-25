import type { AiArcadeChallenge } from './ai';
import { supabase } from './supabase';

export type ArcadeEngineId = 'astral' | 'bastion';
export type ArcadeDifficulty = 'normal' | 'dificil' | 'extremo';

export interface ArcadeGamePalette {
  bg: string;
  primary: string;
  accent: string;
  danger: string;
}

export interface ArcadeGameConfig {
  id: string;
  title: string;
  subtitle: string;
  lore: string;
  genre: string;
  engine: ArcadeEngineId;
  difficulty: ArcadeDifficulty;
  controlsHint: string;
  palette: ArcadeGamePalette;
  speedMultiplier: number;
  spawnMultiplier: number;
  playerTitle: string;
  enemyTitle: string;
  isBuiltIn: boolean;
  isFeatured: boolean;
  isHidden: boolean;
  createdByOwner?: boolean;
  createdAt: string;
}

const CATALOG_STORAGE_KEY = 'trama_arcade_catalog_state_v1';
const HIGH_SCORES_STORAGE_KEY = 'trama_arcade_highscores_v1';

export const BUILTIN_ARCADE_GAMES: ArcadeGameConfig[] = [
  {
    id: 'senda-astral',
    title: 'Senda Astral',
    subtitle: 'Esquiva amenazas 360° y captura runas de éter',
    lore: 'Muévete libremente por toda la arena astral guiando tu prisma arcano. Esquiva meteoros y rayos desde todos los ángulos, encadena reliquias doradas y usa el impulso para romper el peligro.',
    genre: 'Acción · Esquiva 2D',
    engine: 'astral',
    difficulty: 'normal',
    controlsHint: 'WASD / ↑↓←→ o arrastra en cualquier parte · Espacio: Impulso',
    palette: {
      bg: '#080B12',
      primary: '#388BFF',
      accent: '#FBBF24',
      danger: '#F43F5E',
    },
    speedMultiplier: 1,
    spawnMultiplier: 1,
    playerTitle: 'Prisma Astral',
    enemyTitle: 'Meteoros del Vacío',
    isBuiltIn: true,
    isFeatured: true,
    isHidden: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'bastion-de-runas',
    title: 'Bastión de Runas',
    subtitle: 'Combate libre 360° contra oleadas espectrales',
    lore: 'Recorre toda la arena arcana disparando haces rúnicos en 360° contra espectros, cazadores y gólems que surgen desde los cuatro bordes. Recoge sellos de poder y desata el Pulso Nova.',
    genre: 'Arcade · Arena 2D',
    engine: 'bastion',
    difficulty: 'dificil',
    controlsHint: 'WASD / ↑↓←→ o arrastra en cualquier parte · Espacio: Pulso Nova',
    palette: {
      bg: '#0B0914',
      primary: '#F59E0B',
      accent: '#34D399',
      danger: '#EC4899',
    },
    speedMultiplier: 1,
    spawnMultiplier: 1,
    playerTitle: 'Centinela Rúnico',
    enemyTitle: 'Legión Espectral',
    isBuiltIn: true,
    isFeatured: false,
    isHidden: false,
    createdAt: '2026-01-02T00:00:00.000Z',
  },
];

interface StoredArcadeState {
  featuredId: string | null;
  hiddenIds: string[];
  customGames: ArcadeGameConfig[];
}

function readStoredCatalogState(): StoredArcadeState {
  try {
    const raw = window.localStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) {
      return {
        featuredId: 'senda-astral',
        hiddenIds: [],
        customGames: [],
      };
    }
    const parsed = JSON.parse(raw) as Partial<StoredArcadeState>;
    return {
      featuredId:
        typeof parsed.featuredId === 'string' ? parsed.featuredId : null,
      hiddenIds: Array.isArray(parsed.hiddenIds)
        ? parsed.hiddenIds.filter((id): id is string => typeof id === 'string')
        : [],
      customGames: Array.isArray(parsed.customGames)
        ? parsed.customGames
        : [],
    };
  } catch {
    return {
      featuredId: 'senda-astral',
      hiddenIds: [],
      customGames: [],
    };
  }
}

function writeStoredCatalogState(state: StoredArcadeState): void {
  try {
    window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignorar errores de cuota de almacenamiento local
  }
}

export function loadArcadeGames(): ArcadeGameConfig[] {
  const stored = readStoredCatalogState();
  const hiddenSet = new Set(stored.hiddenIds);

  const merged = [...BUILTIN_ARCADE_GAMES, ...stored.customGames].map(
    (game) => ({
      ...game,
      isFeatured: stored.featuredId === game.id,
      isHidden: hiddenSet.has(game.id),
    })
  );

  return merged.sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    return 0;
  });
}

export function setFeaturedArcadeGame(gameId: string | null): ArcadeGameConfig[] {
  const stored = readStoredCatalogState();
  stored.featuredId = stored.featuredId === gameId ? null : gameId;
  writeStoredCatalogState(stored);
  return loadArcadeGames();
}

export function toggleHiddenArcadeGame(gameId: string): ArcadeGameConfig[] {
  const stored = readStoredCatalogState();
  const set = new Set(stored.hiddenIds);
  if (set.has(gameId)) {
    set.delete(gameId);
  } else {
    set.add(gameId);
    if (stored.featuredId === gameId) {
      stored.featuredId = null;
    }
  }
  stored.hiddenIds = Array.from(set);
  writeStoredCatalogState(stored);
  return loadArcadeGames();
}

export function addCustomArcadeChallenge(
  challenge: AiArcadeChallenge
): ArcadeGameConfig[] {
  const stored = readStoredCatalogState();
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const newGame: ArcadeGameConfig = {
    id,
    title: challenge.title,
    subtitle: challenge.subtitle,
    lore: challenge.lore,
    genre:
      challenge.baseEngine === 'astral'
        ? 'Desafío · Esquiva'
        : 'Desafío · Defensa',
    engine: challenge.baseEngine,
    difficulty: challenge.difficulty,
    controlsHint:
      challenge.baseEngine === 'astral'
        ? 'WASD / ↑↓←→ o arrastra en cualquier parte · Espacio: Impulso'
        : 'WASD / ↑↓←→ o arrastra en cualquier parte · Espacio: Pulso Nova',
    palette: challenge.palette,
    speedMultiplier: challenge.speedMultiplier,
    spawnMultiplier: challenge.spawnMultiplier,
    playerTitle: challenge.playerTitle,
    enemyTitle: challenge.enemyTitle,
    isBuiltIn: false,
    isFeatured: true,
    isHidden: false,
    createdByOwner: true,
    createdAt: new Date().toISOString(),
  };

  stored.customGames = [newGame, ...stored.customGames];
  stored.featuredId = id;
  writeStoredCatalogState(stored);
  return loadArcadeGames();
}

export function deleteCustomArcadeChallenge(gameId: string): ArcadeGameConfig[] {
  const stored = readStoredCatalogState();
  stored.customGames = stored.customGames.filter((g) => g.id !== gameId);
  stored.hiddenIds = stored.hiddenIds.filter((id) => id !== gameId);
  if (stored.featuredId === gameId) {
    stored.featuredId = BUILTIN_ARCADE_GAMES[0].id;
  }
  writeStoredCatalogState(stored);
  return loadArcadeGames();
}

export function getArcadeHighScores(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(HIGH_SCORES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const scores: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const num = Number(value);
      if (Number.isFinite(num) && num >= 0) {
        scores[key] = Math.floor(num);
      }
    }
    return scores;
  } catch {
    return {};
  }
}

export function saveArcadeHighScore(gameId: string, score: number): boolean {
  const cleanScore = Math.max(0, Math.floor(score));
  const scores = getArcadeHighScores();
  const prev = scores[gameId] ?? 0;
  if (cleanScore <= prev) return false;
  scores[gameId] = cleanScore;
  try {
    window.localStorage.setItem(HIGH_SCORES_STORAGE_KEY, JSON.stringify(scores));
  } catch {
    // Ignorar error de almacenamiento
  }
  return true;
}

export function formatDifficultyLabel(diff: ArcadeDifficulty): string {
  if (diff === 'extremo') return 'Extremo';
  if (diff === 'dificil') return 'Difícil';
  return 'Normal';
}

export interface ArcadeLeaderboardPlayer {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  badge: string | null;
}

export type ArcadeLeaderboardPeriod = 'week' | 'month' | 'all';

export interface ArcadeLeaderboardEntry {
  id: string;
  user_id: string;
  game_id: string;
  score: number;
  updated_at: string;
  source: 'arcade_scores' | 'arcade_score_logs';
  player: ArcadeLeaderboardPlayer;
}

export interface GlobalScoreSubmitResult {
  saved: boolean;
  logged: boolean;
  previousBest: number;
  bestScore: number;
}

interface RawArcadeScoreRow {
  id: string;
  user_id: string;
  game_id: string;
  score: number;
  updated_at: string;
}

interface RawArcadeScoreLogRow {
  id: string;
  user_id: string;
  game_id: string;
  score: number;
  played_at: string;
}

interface RawProfileLookupRow {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  badge: string | null;
}

export async function submitGlobalArcadeScore(params: {
  userId: string;
  gameId: string;
  score: number;
}): Promise<GlobalScoreSubmitResult> {
  const cleanScore = Math.max(0, Math.floor(params.score));
  if (!params.userId || !params.gameId || cleanScore <= 0) {
    return { saved: false, logged: false, previousBest: 0, bestScore: 0 };
  }

  const nowIso = new Date().toISOString();

  // 1. Registra siempre la partida en el historial para rankings semanal/mensual y retos diarios
  let logged = false;
  const { error: logError } = await supabase.from('arcade_score_logs').insert({
    user_id: params.userId,
    game_id: params.gameId,
    score: cleanScore,
    played_at: nowIso,
  });
  if (!logError) {
    logged = true;
  } else {
    console.warn('No se pudo registrar partida en arcade_score_logs:', logError.message);
  }

  // 2. Comprueba y actualiza el récord histórico en arcade_scores
  const { data: existingRows, error: lookupError } = await supabase
    .from('arcade_scores')
    .select('id, score')
    .eq('user_id', params.userId)
    .eq('game_id', params.gameId)
    .order('score', { ascending: false })
    .limit(1);

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  const existing = existingRows?.[0] as { id: string; score: number } | undefined;
  const previousBest = existing ? Math.max(0, Number(existing.score) || 0) : 0;

  if (cleanScore <= previousBest) {
    return {
      saved: false,
      logged,
      previousBest,
      bestScore: previousBest,
    };
  }

  const { error: upsertError } = await supabase.from('arcade_scores').upsert(
    {
      user_id: params.userId,
      game_id: params.gameId,
      score: cleanScore,
      updated_at: nowIso,
    },
    { onConflict: 'user_id,game_id' }
  );

  if (upsertError) {
    // Si la tabla no tiene índice único compuesto (user_id, game_id), actualizar o insertar manualmente
    if (upsertError.code === '42P10' || upsertError.message.includes('ON CONFLICT')) {
      if (existing) {
        const { error: updateError } = await supabase
          .from('arcade_scores')
          .update({ score: cleanScore, updated_at: nowIso })
          .eq('id', existing.id);
        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await supabase
          .from('arcade_scores')
          .insert({
            user_id: params.userId,
            game_id: params.gameId,
            score: cleanScore,
            updated_at: nowIso,
          });
        if (insertError) throw new Error(insertError.message);
      }
    } else {
      throw new Error(upsertError.message);
    }
  }

  return {
    saved: true,
    logged,
    previousBest,
    bestScore: cleanScore,
  };
}

async function hydratePlayersForRows(
  rows: Array<{
    id: string;
    user_id: string;
    game_id: string;
    score: number;
    timestamp: string;
  }>,
  source: 'arcade_scores' | 'arcade_score_logs'
): Promise<ArcadeLeaderboardEntry[]> {
  if (rows.length === 0) return [];
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

  const { data: profileRows, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, role, badge')
    .in('id', userIds);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const profileMap = new Map<string, ArcadeLeaderboardPlayer>();
  for (const prof of (profileRows ?? []) as RawProfileLookupRow[]) {
    profileMap.set(prof.id, {
      id: prof.id,
      username: prof.username ?? null,
      avatar_url: prof.avatar_url ?? null,
      role: prof.role ?? null,
      badge: prof.badge ?? null,
    });
  }

  return rows.map((row) => ({
    id: String(row.id),
    user_id: row.user_id,
    game_id: row.game_id,
    score: Math.max(0, Number(row.score) || 0),
    updated_at: row.timestamp,
    source,
    player: profileMap.get(row.user_id) ?? {
      id: row.user_id,
      username: null,
      avatar_url: null,
      role: null,
      badge: null,
    },
  }));
}

export async function fetchArcadeLeaderboard(
  gameId: string,
  limit = 10,
  period: ArcadeLeaderboardPeriod = 'all'
): Promise<ArcadeLeaderboardEntry[]> {
  if (!gameId) return [];

  if (period === 'all') {
    const { data: scoreRows, error: scoresError } = await supabase
      .from('arcade_scores')
      .select('id, user_id, game_id, score, updated_at')
      .eq('game_id', gameId)
      .order('score', { ascending: false })
      .order('updated_at', { ascending: true })
      .limit(Math.max(limit * 3, 30));

    if (scoresError) {
      throw new Error(scoresError.message);
    }

    const rawRows = (scoreRows ?? []) as RawArcadeScoreRow[];
    const seenUsers = new Set<string>();
    const topRows: Array<{
      id: string;
      user_id: string;
      game_id: string;
      score: number;
      timestamp: string;
    }> = [];

    for (const row of rawRows) {
      if (!row.user_id || seenUsers.has(row.user_id)) continue;
      seenUsers.add(row.user_id);
      topRows.push({
        id: String(row.id),
        user_id: row.user_id,
        game_id: row.game_id,
        score: row.score,
        timestamp: row.updated_at,
      });
      if (topRows.length >= limit) break;
    }

    return hydratePlayersForRows(topRows, 'arcade_scores');
  }

  // Semanal (7 días) o Mensual (30 días) desde arcade_score_logs agrupando el mejor puntaje por usuario
  const days = period === 'week' ? 7 : 30;
  const cutoffIso = new Date(Date.now() - days * 86400 * 1000).toISOString();

  const { data: logRows, error: logsError } = await supabase
    .from('arcade_score_logs')
    .select('id, user_id, game_id, score, played_at')
    .eq('game_id', gameId)
    .gte('played_at', cutoffIso)
    .order('score', { ascending: false })
    .order('played_at', { ascending: true })
    .limit(300);

  if (logsError) {
    throw new Error(logsError.message);
  }

  const rawLogs = (logRows ?? []) as RawArcadeScoreLogRow[];
  const bestByUser = new Map<string, RawArcadeScoreLogRow>();
  for (const row of rawLogs) {
    if (!row.user_id) continue;
    const prev = bestByUser.get(row.user_id);
    if (!prev || Number(row.score) > Number(prev.score)) {
      bestByUser.set(row.user_id, row);
    }
  }

  const sortedTop = Array.from(bestByUser.values())
    .sort((a, b) => {
      if (Number(b.score) !== Number(a.score)) {
        return Number(b.score) - Number(a.score);
      }
      return new Date(a.played_at).getTime() - new Date(b.played_at).getTime();
    })
    .slice(0, limit)
    .map((row) => ({
      id: String(row.id),
      user_id: row.user_id,
      game_id: row.game_id,
      score: row.score,
      timestamp: row.played_at,
    }));

  return hydratePlayersForRows(sortedTop, 'arcade_score_logs');
}

export async function fetchUserArcadeRecords(
  userId: string
): Promise<Record<string, number>> {
  if (!userId) return {};

  const { data, error } = await supabase
    .from('arcade_scores')
    .select('game_id, score')
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  const records: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ game_id: string; score: number }>) {
    if (!row.game_id) continue;
    const scoreVal = Math.max(0, Number(row.score) || 0);
    if (scoreVal > (records[row.game_id] ?? 0)) {
      records[row.game_id] = scoreVal;
    }
  }
  return records;
}

export async function fetchTodayBestScoreForGame(
  userId: string,
  gameId: string,
  todayStartIso: string
): Promise<number> {
  if (!userId || !gameId) return 0;

  const { data, error } = await supabase
    .from('arcade_score_logs')
    .select('score')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .gte('played_at', todayStartIso)
    .order('score', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return 0;
  return Math.max(0, Number((data[0] as { score: number }).score) || 0);
}

export async function deleteArcadeScore(
  scoreId: string,
  source: 'arcade_scores' | 'arcade_score_logs' = 'arcade_scores'
): Promise<void> {
  const { data, error } = await supabase
    .from(source)
    .delete()
    .eq('id', scoreId)
    .select('id');

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error(
      `No se pudo eliminar el puntaje. Verifica que la política RLS de DELETE en ${source} permita al Dueño borrar registros ajenos.`
    );
  }
}
