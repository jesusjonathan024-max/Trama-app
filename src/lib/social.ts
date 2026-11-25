import { isStrictHttpsUrl, supabase } from './supabase';
import {
  fetchSeriesCatalog,
  type SeriesRecord,
} from './library';
import {
  fetchPostById,
  sortPostsWithPinnedFirst,
  type PostAuthor,
  type PostRecord,
} from './posts';

export type ReadingStatus = 'pendiente' | 'leyendo' | 'terminado';
export type FeedSortMode = 'recent' | 'popular';

export const READING_STATUS_OPTIONS: Array<{
  value: ReadingStatus;
  label: string;
  shortLabel: string;
}> = [
  { value: 'pendiente', label: 'Pendiente de leer', shortLabel: 'Pendiente' },
  { value: 'leyendo', label: 'Leyendo', shortLabel: 'Leyendo' },
  { value: 'terminado', label: 'Terminados', shortLabel: 'Terminado' },
];

export const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  pendiente: 'Pendiente de leer',
  leyendo: 'Leyendo',
  terminado: 'Terminados',
};

export interface SeriesCollectionEntry {
  series_id: string;
  status: ReadingStatus | null;
  is_favorite: boolean;
  updated_at: string;
}

export interface FollowCounts {
  followers: number;
  following: number;
}

export interface PublicUserProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string | null;
  badge: string | null;
  created_at: string;
}

export function sortPostsByMode(
  posts: PostRecord[],
  sortMode: FeedSortMode
): PostRecord[] {
  if (sortMode === 'recent') {
    return sortPostsWithPinnedFirst(posts);
  }

  return [...posts].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) {
      return a.is_pinned ? -1 : 1;
    }
    const scoreA = a.likes_count + a.comments_count;
    const scoreB = b.likes_count + b.comments_count;
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function normalizeReadingStatus(raw: string | null | undefined): ReadingStatus | null {
  const val = (raw ?? '').trim().toLowerCase();
  if (!val) return null;
  if (
    val === 'pendiente' ||
    val === 'pending' ||
    val === 'want_to_read' ||
    val === 'to_read' ||
    val === 'pendiente de leer'
  ) {
    return 'pendiente';
  }
  if (val === 'leyendo' || val === 'reading') {
    return 'leyendo';
  }
  if (
    val === 'terminado' ||
    val === 'terminados' ||
    val === 'completed' ||
    val === 'finished'
  ) {
    return 'terminado';
  }
  return null;
}

// ---------- Seguidores y Autores (public.user_follows) ----------

export async function fetchFollowingIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => String(row.following_id ?? ''))
    .filter(Boolean);
}

export async function fetchFollowCounts(userId: string): Promise<FollowCounts> {
  const [followersRes, followingRes] = await Promise.all([
    supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId),
    supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId),
  ]);

  if (followersRes.error) {
    throw new Error(followersRes.error.message);
  }
  if (followingRes.error) {
    throw new Error(followingRes.error.message);
  }

  return {
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
  };
}

export async function followUser(
  followerId: string,
  followingId: string
): Promise<void> {
  if (!followerId || !followingId || followerId === followingId) return;

  const { error } = await supabase.from('user_follows').insert({
    follower_id: followerId,
    following_id: followingId,
  });

  if (error && error.code !== '23505') {
    throw new Error(error.message);
  }
}

export async function unfollowUser(
  followerId: string,
  followingId: string
): Promise<void> {
  if (!followerId || !followingId) return;

  const { error } = await supabase
    .from('user_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);

  if (error) {
    throw new Error(error.message);
  }
}

// ---------- Guardados de Publicaciones (public.user_collections) ----------

export async function fetchSavedPostIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_collections')
    .select('post_id')
    .eq('user_id', userId)
    .not('post_id', 'is', null)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => (row.post_id ? String(row.post_id) : ''))
    .filter(Boolean);
}

export async function savePostToCollection(
  userId: string,
  postId: string
): Promise<void> {
  const now = new Date().toISOString();
  const candidateStatuses = ['saved', 'guardado', 'pendiente', 'pending'];

  let lastError: string | null = null;

  for (const statusValue of candidateStatuses) {
    const { error } = await supabase.from('user_collections').upsert(
      {
        user_id: userId,
        post_id: postId,
        status: statusValue,
        is_favorite: false,
        updated_at: now,
      },
      { onConflict: 'user_id,post_id' }
    );

    if (!error) return;

    // Si el conflicto de upsert no coincide con una constraint única compuesta, probamos insert/update
    if (error.code === '42P10') {
      const { data: existing } = await supabase
        .from('user_collections')
        .select('post_id')
        .eq('user_id', userId)
        .eq('post_id', postId)
        .maybeSingle();

      if (existing) {
        const { error: updErr } = await supabase
          .from('user_collections')
          .update({ status: statusValue, updated_at: now })
          .eq('user_id', userId)
          .eq('post_id', postId);
        if (!updErr) return;
        lastError = updErr.message;
        if (updErr.code !== '23514') break;
        continue;
      }

      const { error: insErr } = await supabase.from('user_collections').insert({
        user_id: userId,
        post_id: postId,
        status: statusValue,
        is_favorite: false,
        updated_at: now,
      });
      if (!insErr || insErr.code === '23505') return;
      lastError = insErr.message;
      if (insErr.code !== '23514') break;
      continue;
    }

    lastError = error.message;
    // Solo reintenta con otro valor de status si hay CHECK constraint (23514)
    if (error.code !== '23514') {
      break;
    }
  }

  throw new Error(
    lastError || 'No se pudo guardar esta publicación en tu colección.'
  );
}

export async function removePostFromCollection(
  userId: string,
  postId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_collections')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId);

  if (error) {
    throw new Error(error.message);
  }
}

// ---------- Listas de Lectura y Favoritos de Biblioteca ----------
// Detecta automáticamente si public.user_collections ya cuenta con la columna series_id.
// Mientras tanto (o si no existe la columna aún), sincroniza de forma segura por usuario en localStorage
// para evitar errores de llave foránea con posts(id), y activa el sync en la nube en cuanto exista series_id.

const SERIES_COLLECTION_STORAGE_PREFIX = 'trama_series_collections_v1_';
let cachedHasSeriesIdColumn: boolean | null = null;

function readLocalSeriesCollections(
  userId: string
): Record<string, SeriesCollectionEntry> {
  try {
    const raw = window.localStorage.getItem(
      `${SERIES_COLLECTION_STORAGE_PREFIX}${userId}`
    );
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SeriesCollectionEntry>;
    const clean: Record<string, SeriesCollectionEntry> = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry !== 'object') continue;
      const status = normalizeReadingStatus(entry.status);
      const isFav = Boolean(entry.is_favorite);
      if (!status && !isFav) continue;
      clean[id] = {
        series_id: id,
        status,
        is_favorite: isFav,
        updated_at: entry.updated_at || new Date().toISOString(),
      };
    }
    return clean;
  } catch {
    return {};
  }
}

function writeLocalSeriesCollections(
  userId: string,
  map: Record<string, SeriesCollectionEntry>
): void {
  try {
    window.localStorage.setItem(
      `${SERIES_COLLECTION_STORAGE_PREFIX}${userId}`,
      JSON.stringify(map)
    );
  } catch {
    // Ignora cuota o modo privado
  }
}

function isMissingColumnError(message: string | undefined, column: string): boolean {
  const lower = (message ?? '').toLowerCase();
  return (
    lower.includes(column.toLowerCase()) &&
    (lower.includes('does not exist') ||
      lower.includes('could not find') ||
      lower.includes('schema cache'))
  );
}

export async function fetchSeriesCollections(
  userId: string
): Promise<Record<string, SeriesCollectionEntry>> {
  const localMap = readLocalSeriesCollections(userId);

  if (cachedHasSeriesIdColumn === false) {
    return localMap;
  }

  const { data, error } = await supabase
    .from('user_collections')
    .select('series_id, status, is_favorite, updated_at')
    .eq('user_id', userId)
    .not('series_id', 'is', null);

  if (error) {
    if (isMissingColumnError(error.message, 'series_id')) {
      cachedHasSeriesIdColumn = false;
      return localMap;
    }
    return localMap;
  }

  cachedHasSeriesIdColumn = true;
  const merged: Record<string, SeriesCollectionEntry> = { ...localMap };

  for (const row of data ?? []) {
    const sid = row.series_id ? String(row.series_id) : '';
    if (!sid) continue;
    const status = normalizeReadingStatus(row.status);
    const isFav = Boolean(row.is_favorite);
    if (!status && !isFav) continue;
    merged[sid] = {
      series_id: sid,
      status,
      is_favorite: isFav,
      updated_at: row.updated_at || new Date().toISOString(),
    };
  }

  writeLocalSeriesCollections(userId, merged);
  return merged;
}

export async function saveSeriesCollectionEntry(
  userId: string,
  seriesId: string,
  nextStatus: ReadingStatus | null,
  nextFavorite: boolean
): Promise<void> {
  const now = new Date().toISOString();
  const localMap = readLocalSeriesCollections(userId);

  if (!nextStatus && !nextFavorite) {
    delete localMap[seriesId];
  } else {
    localMap[seriesId] = {
      series_id: seriesId,
      status: nextStatus,
      is_favorite: nextFavorite,
      updated_at: now,
    };
  }
  writeLocalSeriesCollections(userId, localMap);

  if (cachedHasSeriesIdColumn === false) {
    return;
  }

  if (!nextStatus && !nextFavorite) {
    const { error } = await supabase
      .from('user_collections')
      .delete()
      .eq('user_id', userId)
      .eq('series_id', seriesId);

    if (error && isMissingColumnError(error.message, 'series_id')) {
      cachedHasSeriesIdColumn = false;
    }
    return;
  }

  const statusForDb = nextStatus ?? 'saved';
  const { data: existing, error: selErr } = await supabase
    .from('user_collections')
    .select('series_id')
    .eq('user_id', userId)
    .eq('series_id', seriesId)
    .maybeSingle();

  if (selErr) {
    if (isMissingColumnError(selErr.message, 'series_id')) {
      cachedHasSeriesIdColumn = false;
    }
    return;
  }

  cachedHasSeriesIdColumn = true;

  if (existing) {
    await supabase
      .from('user_collections')
      .update({
        status: statusForDb,
        is_favorite: nextFavorite,
        updated_at: now,
      })
      .eq('user_id', userId)
      .eq('series_id', seriesId);
  } else {
    await supabase.from('user_collections').insert({
      user_id: userId,
      series_id: seriesId,
      status: statusForDb,
      is_favorite: nextFavorite,
      updated_at: now,
    });
  }
}

// ---------- Perfiles Públicos y Colecciones Hidratadas ----------

export async function fetchPublicProfile(
  userId: string
): Promise<PublicUserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, bio, role, badge, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  return {
    id: data.id,
    username: data.username ?? null,
    avatar_url: data.avatar_url ?? null,
    bio: data.bio ?? null,
    role: data.role ?? null,
    badge: data.badge ?? null,
    created_at: data.created_at,
  };
}

interface RawAuthorPostRow {
  id: string;
  author_id: string;
  mode: string;
  category: string;
  title: string | null;
  content: string;
  image_url: string | null;
  source_name?: string | null;
  source_url?: string | null;
  is_verified?: boolean | null;
  views_count?: number | null;
  likes_count: number | null;
  is_pinned?: boolean | null;
  community_id?: string | null;
  created_at: string;
  author: PostAuthor | PostAuthor[] | null;
  comments: Array<{ count?: number }> | null;
  post_likes: Array<{ count?: number }> | null;
}

function mapSimplePostRows(
  rows: RawAuthorPostRow[],
  likedPostIds: Set<string>
): PostRecord[] {
  return rows.map((row) => {
    const author = Array.isArray(row.author)
      ? row.author[0] ?? null
      : row.author ?? null;
    const likesCount =
      Array.isArray(row.post_likes) &&
      typeof row.post_likes[0]?.count === 'number'
        ? row.post_likes[0].count
        : row.likes_count ?? 0;
    const commentsCount =
      Array.isArray(row.comments) && typeof row.comments[0]?.count === 'number'
        ? row.comments[0].count
        : 0;

    return {
      id: row.id,
      author_id: row.author_id,
      mode: row.mode === 'comunidad' ? 'comunidad' : 'actualidad',
      category: row.category,
      title: row.title ?? null,
      content: row.content ?? '',
      image_url: row.image_url ?? null,
      source_name: row.source_name?.trim() || null,
      source_url:
        row.source_url && isStrictHttpsUrl(row.source_url)
          ? row.source_url.trim()
          : null,
      is_verified: Boolean(row.is_verified),
      views_count: typeof row.views_count === 'number' ? row.views_count : 0,
      is_pinned: Boolean(row.is_pinned),
      community_id: row.community_id ?? null,
      created_at: row.created_at,
      author,
      likes_count: likesCount,
      comments_count: commentsCount,
      liked_by_me: likedPostIds.has(row.id),
    };
  });
}

export async function fetchPostsByAuthor(
  authorId: string,
  currentUserId?: string | null
): Promise<PostRecord[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(
      `
      id,
      author_id,
      mode,
      category,
      title,
      content,
      image_url,
      source_name,
      source_url,
      is_verified,
      views_count,
      likes_count,
      is_pinned,
      community_id,
      created_at,
      author:profiles!posts_author_id_fkey(id, username, avatar_url, role, badge),
      comments(count),
      post_likes(count)
    `
    )
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as RawAuthorPostRow[];
  const likedIds = new Set<string>();

  if (currentUserId && rows.length > 0) {
    const { data: likesData } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', currentUserId)
      .in(
        'post_id',
        rows.map((r) => r.id)
      );

    for (const item of likesData ?? []) {
      if (item.post_id) likedIds.add(String(item.post_id));
    }
  }

  return mapSimplePostRows(rows, likedIds);
}

export async function fetchPostsByIds(
  postIds: string[],
  currentUserId?: string | null
): Promise<PostRecord[]> {
  if (postIds.length === 0) return [];

  const { data, error } = await supabase
    .from('posts')
    .select(
      `
      id,
      author_id,
      mode,
      category,
      title,
      content,
      image_url,
      source_name,
      source_url,
      is_verified,
      views_count,
      likes_count,
      is_pinned,
      community_id,
      created_at,
      author:profiles!posts_author_id_fkey(id, username, avatar_url, role, badge),
      comments(count),
      post_likes(count)
    `
    )
    .in('id', postIds);

  if (error) {
    // Respaldo individual si falla el query compuesto
    const fallback = await Promise.all(
      postIds.slice(0, 20).map((id) => fetchPostById(id, currentUserId))
    );
    return fallback.filter((p): p is PostRecord => Boolean(p));
  }

  const rows = (data ?? []) as unknown as RawAuthorPostRow[];
  const likedIds = new Set<string>();

  if (currentUserId && rows.length > 0) {
    const { data: likesData } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', currentUserId)
      .in(
        'post_id',
        rows.map((r) => r.id)
      );

    for (const item of likesData ?? []) {
      if (item.post_id) likedIds.add(String(item.post_id));
    }
  }

  const mapped = mapSimplePostRows(rows, likedIds);
  const byId = new Map(mapped.map((p) => [p.id, p]));
  return postIds.map((id) => byId.get(id)).filter((p): p is PostRecord => Boolean(p));
}

export async function fetchSeriesByAuthor(
  authorId: string
): Promise<SeriesRecord[]> {
  const all = await fetchSeriesCatalog();
  return all.filter((item) => item.author_id === authorId);
}
