import { supabase } from './supabase';
import type { PostAuthor } from './posts';

// =============================================================================
// 1. SUB-COMUNIDADES TEMÁTICAS (public.communities y public.community_members)
// =============================================================================

export const COMMUNITY_ICON_PRESETS = [
  '🎮',
  '🎌',
  '✍️',
  '💻',
  '📚',
  '🎬',
  '🎨',
  '🎵',
  '🌌',
  '⚔️',
  '🧠',
  '🔥',
] as const;

export interface CommunityRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  creator_id: string | null;
  created_at: string;
  members_count: number;
  is_member: boolean;
}

interface RawCommunityRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  creator_id: string | null;
  created_at: string;
}

interface RawCommunityMemberRow {
  community_id: string;
  user_id: string;
}

export function slugifyCommunityName(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return normalized || `grupo-${Date.now().toString(36)}`;
}

export async function fetchCommunities(
  currentUserId?: string | null
): Promise<CommunityRecord[]> {
  const { data: rows, error } = await supabase
    .from('communities')
    .select('id, name, slug, description, icon, creator_id, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const list = (rows ?? []) as RawCommunityRow[];
  if (list.length === 0) return [];

  const ids = list.map((c) => c.id);
  const { data: memberRows } = await supabase
    .from('community_members')
    .select('community_id, user_id')
    .in('community_id', ids);

  const countByCommunity = new Map<string, number>();
  const joinedSet = new Set<string>();

  for (const row of (memberRows ?? []) as RawCommunityMemberRow[]) {
    countByCommunity.set(
      row.community_id,
      (countByCommunity.get(row.community_id) ?? 0) + 1
    );
    if (currentUserId && row.user_id === currentUserId) {
      joinedSet.add(row.community_id);
    }
  }

  return list
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description?.trim() || null,
      icon: c.icon?.trim() || '💬',
      creator_id: c.creator_id ?? null,
      created_at: c.created_at,
      members_count: countByCommunity.get(c.id) ?? 0,
      is_member: joinedSet.has(c.id),
    }))
    .sort((a, b) => {
      if (a.is_member !== b.is_member) return a.is_member ? -1 : 1;
      if (b.members_count !== a.members_count) {
        return b.members_count - a.members_count;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

export async function createCommunity(params: {
  creatorId: string;
  name: string;
  description: string;
  icon: string;
}): Promise<CommunityRecord> {
  const cleanName = params.name.trim();
  const cleanDesc = params.description.trim();
  const cleanIcon = params.icon.trim().slice(0, 8) || '💬';

  if (cleanName.length < 2 || cleanName.length > 60) {
    throw new Error('El nombre de la comunidad debe tener entre 2 y 60 caracteres.');
  }

  const baseSlug = slugifyCommunityName(cleanName);
  let inserted: RawCommunityRow | null = null;

  const firstAttempt = await supabase
    .from('communities')
    .insert({
      name: cleanName,
      slug: baseSlug,
      description: cleanDesc || null,
      icon: cleanIcon,
      creator_id: params.creatorId,
    })
    .select('id, name, slug, description, icon, creator_id, created_at')
    .single();

  if (firstAttempt.error) {
    // Si el slug ya existe, intenta con un sufijo único
    if (firstAttempt.error.code === '23505') {
      const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const retryAttempt = await supabase
        .from('communities')
        .insert({
          name: cleanName,
          slug: uniqueSlug,
          description: cleanDesc || null,
          icon: cleanIcon,
          creator_id: params.creatorId,
        })
        .select('id, name, slug, description, icon, creator_id, created_at')
        .single();

      if (retryAttempt.error) {
        throw new Error(retryAttempt.error.message);
      }
      inserted = retryAttempt.data as RawCommunityRow;
    } else {
      throw new Error(firstAttempt.error.message);
    }
  } else {
    inserted = firstAttempt.data as RawCommunityRow;
  }

  // Une automáticamente al creador a su nueva comunidad
  await supabase.from('community_members').insert({
    community_id: inserted.id,
    user_id: params.creatorId,
  });

  return {
    id: inserted.id,
    name: inserted.name,
    slug: inserted.slug,
    description: inserted.description?.trim() || null,
    icon: inserted.icon?.trim() || cleanIcon,
    creator_id: inserted.creator_id ?? params.creatorId,
    created_at: inserted.created_at,
    members_count: 1,
    is_member: true,
  };
}

export async function joinCommunity(
  communityId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase.from('community_members').insert({
    community_id: communityId,
    user_id: userId,
  });

  if (error && error.code !== '23505') {
    throw new Error(error.message);
  }
}

export async function leaveCommunity(
  communityId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('community_members')
    .delete()
    .eq('community_id', communityId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

// =============================================================================
// 2. MENSAJES PRIVADOS (public.direct_messages)
// =============================================================================

export interface DirectMessageRecord {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface ConversationSummary {
  partner: PostAuthor;
  lastMessage: DirectMessageRecord;
  unreadCount: number;
}

async function fetchProfilesMapByIds(
  userIds: string[]
): Promise<Map<string, PostAuthor>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, PostAuthor>();
  if (unique.length === 0) return map;

  const { data } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, role, badge')
    .in('id', unique);

  for (const row of (data ?? []) as PostAuthor[]) {
    map.set(row.id, {
      id: row.id,
      username: row.username ?? null,
      avatar_url: row.avatar_url ?? null,
      role: row.role ?? null,
      badge: row.badge ?? null,
    });
  }
  return map;
}

export async function fetchUnreadDirectMessageCount(
  userId: string
): Promise<number> {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('direct_messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);

  if (error) return 0;
  return count ?? 0;
}

export async function fetchDirectConversations(
  userId: string
): Promise<ConversationSummary[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('direct_messages')
    .select('id, sender_id, recipient_id, content, is_read, created_at')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as DirectMessageRecord[];
  if (rows.length === 0) return [];

  const lastByPartner = new Map<string, DirectMessageRecord>();
  const unreadByPartner = new Map<string, number>();

  for (const msg of rows) {
    const partnerId =
      msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
    if (!partnerId || partnerId === userId) continue;

    if (!lastByPartner.has(partnerId)) {
      lastByPartner.set(partnerId, msg);
    }

    if (msg.recipient_id === userId && !msg.is_read) {
      unreadByPartner.set(partnerId, (unreadByPartner.get(partnerId) ?? 0) + 1);
    }
  }

  const partnerIds = Array.from(lastByPartner.keys());
  const profilesMap = await fetchProfilesMapByIds(partnerIds);

  return partnerIds
    .map((partnerId) => {
      const lastMessage = lastByPartner.get(partnerId)!;
      const partner: PostAuthor = profilesMap.get(partnerId) ?? {
        id: partnerId,
        username: 'Usuario de Trama',
        avatar_url: null,
        role: null,
        badge: null,
      };
      return {
        partner,
        lastMessage,
        unreadCount: unreadByPartner.get(partnerId) ?? 0,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.lastMessage.created_at).getTime() -
        new Date(a.lastMessage.created_at).getTime()
    );
}

export async function fetchConversationMessages(
  userId: string,
  partnerId: string,
  limit = 120
): Promise<DirectMessageRecord[]> {
  if (!userId || !partnerId) return [];

  const { data, error } = await supabase
    .from('direct_messages')
    .select('id, sender_id, recipient_id, content, is_read, created_at')
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${userId})`
    )
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DirectMessageRecord[];
}

export async function sendDirectMessage(params: {
  senderId: string;
  recipientId: string;
  content: string;
}): Promise<DirectMessageRecord> {
  const clean = params.content.trim();
  if (!clean) {
    throw new Error('Escribe un mensaje antes de enviar.');
  }
  if (clean.length > 2000) {
    throw new Error('El mensaje no puede superar los 2,000 caracteres.');
  }
  if (params.senderId === params.recipientId) {
    throw new Error('No puedes enviarte mensajes privados a ti mismo.');
  }

  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      sender_id: params.senderId,
      recipient_id: params.recipientId,
      content: clean,
      is_read: false,
    })
    .select('id, sender_id, recipient_id, content, is_read, created_at')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as DirectMessageRecord;
}

export async function markConversationRead(
  userId: string,
  partnerId: string
): Promise<void> {
  if (!userId || !partnerId) return;

  await supabase
    .from('direct_messages')
    .update({ is_read: true })
    .eq('recipient_id', userId)
    .eq('sender_id', partnerId)
    .eq('is_read', false);
}

export async function fetchRegisteredUsersDirectory(
  excludeUserId?: string | null,
  searchQuery = ''
): Promise<PostAuthor[]> {
  let query = supabase
    .from('profiles')
    .select('id, username, avatar_url, role, badge')
    .order('username', { ascending: true })
    .limit(60);

  if (excludeUserId) {
    query = query.neq('id', excludeUserId);
  }

  const trimmed = searchQuery.trim();
  if (trimmed) {
    query = query.ilike('username', `%${trimmed}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as PostAuthor[]).map((row) => ({
    id: row.id,
    username: row.username ?? null,
    avatar_url: row.avatar_url ?? null,
    role: row.role ?? null,
    badge: row.badge ?? null,
  }));
}

// =============================================================================
// 3. RETOS ENTRE AMIGOS 1v1 EN ARCADE (public.arcade_challenges)
// =============================================================================

export const DUEL_SUPPORTED_GAMES = [
  { id: 'senda-astral', title: 'Senda Astral' },
  { id: 'bastion-de-runas', title: 'Bastión de Runas' },
  { id: 'pulso-neon', title: 'Pulso Neón' },
  { id: 'codice-runico', title: 'Códice Rúnico' },
  { id: 'salto-vacio', title: 'Salto del Vacío' },
  { id: 'oraculo-trama', title: 'Oráculo de Trama' },
] as const;

export type DuelGameId = (typeof DUEL_SUPPORTED_GAMES)[number]['id'];

export interface ArcadeChallengeRecord {
  id: string;
  game_id: string;
  challenger_id: string;
  challenged_id: string;
  challenger_score: number;
  challenged_score: number | null;
  status: 'pending' | 'completed' | string;
  created_at: string;
  challenger: PostAuthor;
  challenged: PostAuthor;
}

interface RawChallengeRow {
  id: string;
  game_id: string;
  challenger_id: string;
  challenged_id: string;
  challenger_score: number | string;
  challenged_score: number | string | null;
  status: string;
  created_at: string;
}

export function normalizeDuelGameId(gameId: string): string {
  if (gameId === 'bastion-runas') return 'bastion-de-runas';
  return gameId;
}

export function getDuelGameTitle(gameId: string): string {
  const normalized = normalizeDuelGameId(gameId);
  const found = DUEL_SUPPORTED_GAMES.find((g) => g.id === normalized);
  return found ? found.title : gameId;
}

export async function fetchUserArcadeChallenges(
  userId: string
): Promise<ArcadeChallengeRecord[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('arcade_challenges')
    .select(
      'id, game_id, challenger_id, challenged_id, challenger_score, challenged_score, status, created_at'
    )
    .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as RawChallengeRow[];
  if (rows.length === 0) return [];

  const userIds = rows.flatMap((r) => [r.challenger_id, r.challenged_id]);
  const profilesMap = await fetchProfilesMapByIds(userIds);

  return rows.map((row) => ({
    id: row.id,
    game_id: row.game_id,
    challenger_id: row.challenger_id,
    challenged_id: row.challenged_id,
    challenger_score: Math.max(0, Math.floor(Number(row.challenger_score) || 0)),
    challenged_score:
      row.challenged_score !== null && row.challenged_score !== undefined
        ? Math.max(0, Math.floor(Number(row.challenged_score) || 0))
        : null,
    status: row.status || 'pending',
    created_at: row.created_at,
    challenger: profilesMap.get(row.challenger_id) ?? {
      id: row.challenger_id,
      username: 'Jugador',
      avatar_url: null,
      role: null,
      badge: null,
    },
    challenged: profilesMap.get(row.challenged_id) ?? {
      id: row.challenged_id,
      username: 'Jugador',
      avatar_url: null,
      role: null,
      badge: null,
    },
  }));
}

export async function createArcadeChallenge(params: {
  gameId: DuelGameId;
  challengerId: string;
  challengedId: string;
  challengerScore: number;
}): Promise<void> {
  if (params.challengerId === params.challengedId) {
    throw new Error('Elige a otro usuario registrado para enviar un reto.');
  }

  const cleanScore = Math.max(0, Math.floor(params.challengerScore));
  const { error } = await supabase.from('arcade_challenges').insert({
    game_id: params.gameId,
    challenger_id: params.challengerId,
    challenged_id: params.challengedId,
    challenger_score: cleanScore,
    challenged_score: null,
    status: 'pending',
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function completeArcadeChallenge(params: {
  challengeId: string;
  challengedId: string;
  challengedScore: number;
}): Promise<void> {
  const cleanScore = Math.max(0, Math.floor(params.challengedScore));
  const { error } = await supabase
    .from('arcade_challenges')
    .update({
      challenged_score: cleanScore,
      status: 'completed',
    })
    .eq('id', params.challengeId)
    .eq('challenged_id', params.challengedId);

  if (error) {
    throw new Error(error.message);
  }
}

// =============================================================================
// 4. JUEGOS DE LA COMUNIDAD EN SANDBOX (public.community_games)
// =============================================================================

export const MAX_COMMUNITY_GAME_BYTES = 50 * 1024; // 50 KB exactos

export type CommunityGameStatus = 'pending' | 'approved' | 'rejected';

export interface CommunityGameRecord {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  html_code: string;
  status: CommunityGameStatus;
  created_at: string;
  author: PostAuthor;
}

interface RawCommunityGameRow {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  html_code: string;
  status: string;
  created_at: string;
}

export function getUtf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function formatCommunityGameStatus(status: string): string {
  const norm = status.trim().toLowerCase();
  if (norm === 'approved') return 'Aprobado';
  if (norm === 'rejected') return 'Rechazado';
  return 'Pendiente';
}

function normalizeGameStatus(status: string): CommunityGameStatus {
  const norm = (status ?? '').trim().toLowerCase();
  if (norm === 'approved') return 'approved';
  if (norm === 'rejected') return 'rejected';
  return 'pending';
}

async function hydrateCommunityGames(
  rows: RawCommunityGameRow[]
): Promise<CommunityGameRecord[]> {
  if (rows.length === 0) return [];
  const profilesMap = await fetchProfilesMapByIds(rows.map((r) => r.author_id));
  return rows.map((row) => ({
    id: row.id,
    author_id: row.author_id,
    title: row.title,
    description: row.description?.trim() || null,
    html_code: row.html_code,
    status: normalizeGameStatus(row.status),
    created_at: row.created_at,
    author: profilesMap.get(row.author_id) ?? {
      id: row.author_id,
      username: 'Creador de Trama',
      avatar_url: null,
      role: null,
      badge: null,
    },
  }));
}

export async function fetchApprovedCommunityGames(): Promise<
  CommunityGameRecord[]
> {
  const { data, error } = await supabase
    .from('community_games')
    .select('id, author_id, title, description, html_code, status, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return hydrateCommunityGames((data ?? []) as RawCommunityGameRow[]);
}

export async function fetchMyCommunityGames(
  userId: string
): Promise<CommunityGameRecord[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('community_games')
    .select('id, author_id, title, description, html_code, status, created_at')
    .eq('author_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return hydrateCommunityGames((data ?? []) as RawCommunityGameRow[]);
}

export async function fetchAllCommunityGamesForOwner(): Promise<
  CommunityGameRecord[]
> {
  const { data, error } = await supabase
    .from('community_games')
    .select('id, author_id, title, description, html_code, status, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return hydrateCommunityGames((data ?? []) as RawCommunityGameRow[]);
}

export async function submitCommunityGame(params: {
  authorId: string;
  title: string;
  description: string;
  htmlCode: string;
}): Promise<CommunityGameRecord> {
  const cleanTitle = params.title.trim();
  const cleanDesc = params.description.trim();
  const code = params.htmlCode.trim();

  if (cleanTitle.length < 2 || cleanTitle.length > 80) {
    throw new Error('El título del juego debe tener entre 2 y 80 caracteres.');
  }
  if (!code) {
    throw new Error('Pega el código HTML5/JS de tu minijuego antes de enviarlo.');
  }
  const byteSize = getUtf8ByteLength(code);
  if (byteSize > MAX_COMMUNITY_GAME_BYTES) {
    throw new Error(
      `El código supera el límite de 50 KB (${(byteSize / 1024).toFixed(1)} KB actuales).`
    );
  }

  const { data, error } = await supabase
    .from('community_games')
    .insert({
      author_id: params.authorId,
      title: cleanTitle,
      description: cleanDesc || null,
      html_code: code,
      status: 'pending',
    })
    .select('id, author_id, title, description, html_code, status, created_at')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const hydrated = await hydrateCommunityGames([data as RawCommunityGameRow]);
  return hydrated[0];
}

export async function moderateCommunityGame(
  gameId: string,
  nextStatus: 'approved' | 'rejected'
): Promise<CommunityGameStatus> {
  const { error } = await supabase
    .from('community_games')
    .update({ status: nextStatus })
    .eq('id', gameId);

  if (error) {
    throw new Error(error.message);
  }
  return nextStatus;
}

export async function deleteCommunityGame(gameId: string): Promise<void> {
  const { error } = await supabase
    .from('community_games')
    .delete()
    .eq('id', gameId);

  if (error) {
    throw new Error(error.message);
  }
}

export const COMMUNITY_GAME_STARTER_TEMPLATE = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0b0f19;
      color: #f3f4f6;
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
      user-select: none;
    }
    canvas {
      border: 1px solid #262b36;
      border-radius: 12px;
      background: #111622;
      max-width: 96vw;
      max-height: 78vh;
      touch-action: none;
    }
    .hud {
      margin-bottom: 10px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
  </style>
</head>
<body>
  <div class="hud">PUNTOS: <span id="score">0</span></div>
  <canvas id="c" width="420" height="420"></canvas>
  <script>
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    let px = 210, py = 210, score = 0;
    let ox = 100, oy = 100;
    const keys = {};
    addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
    addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
    canvas.addEventListener('pointermove', e => {
      if (e.buttons || e.pointerType === 'touch') {
        const r = canvas.getBoundingClientRect();
        px = (e.clientX - r.left) * (canvas.width / r.width);
        py = (e.clientY - r.top) * (canvas.height / r.height);
      }
    });
    function loop() {
      const sp = 4;
      if (keys['arrowleft'] || keys['a']) px -= sp;
      if (keys['arrowright'] || keys['d']) px += sp;
      if (keys['arrowup'] || keys['w']) py -= sp;
      if (keys['arrowdown'] || keys['s']) py += sp;
      px = Math.max(16, Math.min(canvas.width - 16, px));
      py = Math.max(16, Math.min(canvas.height - 16, py));
      if (Math.hypot(px - ox, py - oy) < 26) {
        score += 10;
        scoreEl.textContent = score;
        ox = 24 + Math.random() * (canvas.width - 48);
        oy = 24 + Math.random() * (canvas.height - 48);
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(ox, oy, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2); ctx.fill();
      requestAnimationFrame(loop);
    }
    loop();
  </script>
</body>
</html>`;
