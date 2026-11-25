import { MEDIA_BUCKET, isSafeHttpUrl, supabase } from './supabase';

export type PostMode = 'actualidad' | 'comunidad';

export const ACTUALIDAD_CATEGORIES = [
  'Economía',
  'Mundo',
  'Tecnología',
  'Sociedad',
] as const;

export const COMUNIDAD_CATEGORIES = [
  'Debate',
  'Anime y Manga',
  'Novelas',
  'Off-Topic',
] as const;

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export interface PostAuthor {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role?: string | null;
}

export interface PostRecord {
  id: string;
  author_id: string;
  mode: PostMode;
  category: string;
  title: string | null;
  content: string;
  image_url: string | null;
  is_pinned: boolean;
  created_at: string;
  author: PostAuthor | null;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
}

export interface CommentRecord {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  author: PostAuthor | null;
}

export interface CommentNode extends CommentRecord {
  replies: CommentNode[];
}

export interface OwnerPlatformStats {
  totalUsers: number;
  totalPosts: number;
  totalComments: number;
}

interface RawCountItem {
  count?: number;
}

interface RawPostRow {
  id: string;
  author_id: string;
  mode: string;
  category: string;
  title: string | null;
  content: string;
  image_url: string | null;
  likes_count: number | null;
  is_pinned?: boolean | null;
  created_at: string;
  author: PostAuthor | PostAuthor[] | null;
  comments: RawCountItem[] | null;
  post_likes: RawCountItem[] | null;
}

interface RawCommentRow {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  author: PostAuthor | PostAuthor[] | null;
}

function normalizeAuthor(
  raw: PostAuthor | PostAuthor[] | null | undefined
): PostAuthor | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function extractCount(items: RawCountItem[] | null | undefined): number | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const value = items[0]?.count;
  return typeof value === 'number' ? value : null;
}

function mapRawPost(
  row: RawPostRow,
  likedPostIds: Set<string>
): PostRecord {
  const likesFromRelation = extractCount(row.post_likes);
  const commentsFromRelation = extractCount(row.comments);

  return {
    id: row.id,
    author_id: row.author_id,
    mode: row.mode === 'comunidad' ? 'comunidad' : 'actualidad',
    category: row.category,
    title: row.title ?? null,
    content: row.content ?? '',
    image_url: row.image_url ?? null,
    is_pinned: Boolean(row.is_pinned),
    created_at: row.created_at,
    author: normalizeAuthor(row.author),
    likes_count: likesFromRelation ?? row.likes_count ?? 0,
    comments_count: commentsFromRelation ?? 0,
    liked_by_me: likedPostIds.has(row.id),
  };
}

function isMissingPinColumnError(message: string | undefined): boolean {
  const lower = (message ?? '').toLowerCase();
  return lower.includes('is_pinned') && (lower.includes('does not exist') || lower.includes('could not find'));
}

const POST_SELECT_WITH_PIN = `
  id,
  author_id,
  mode,
  category,
  title,
  content,
  image_url,
  likes_count,
  is_pinned,
  created_at,
  author:profiles!posts_author_id_fkey(id, username, avatar_url, role),
  comments(count),
  post_likes(count)
`;

const POST_SELECT_BASE = `
  id,
  author_id,
  mode,
  category,
  title,
  content,
  image_url,
  likes_count,
  created_at,
  author:profiles!posts_author_id_fkey(id, username, avatar_url, role),
  comments(count),
  post_likes(count)
`;

export function sortPostsWithPinnedFirst(posts: PostRecord[]): PostRecord[] {
  return [...posts].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) {
      return a.is_pinned ? -1 : 1;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export async function fetchPostsByMode(
  mode: PostMode,
  currentUserId?: string | null
): Promise<PostRecord[]> {
  let rows: RawPostRow[] = [];

  const withPinResult = await supabase
    .from('posts')
    .select(POST_SELECT_WITH_PIN)
    .eq('mode', mode)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (withPinResult.error) {
    if (isMissingPinColumnError(withPinResult.error.message)) {
      const fallbackResult = await supabase
        .from('posts')
        .select(POST_SELECT_BASE)
        .eq('mode', mode)
        .order('created_at', { ascending: false });

      if (fallbackResult.error) {
        throw new Error(fallbackResult.error.message);
      }
      rows = (fallbackResult.data ?? []) as unknown as RawPostRow[];
    } else {
      throw new Error(withPinResult.error.message);
    }
  } else {
    rows = (withPinResult.data ?? []) as unknown as RawPostRow[];
  }

  const likedPostIds = new Set<string>();

  if (currentUserId && rows.length > 0) {
    const postIds = rows.map((row) => row.id);
    const { data: likesData, error: likesError } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', currentUserId)
      .in('post_id', postIds);

    if (!likesError && likesData) {
      for (const item of likesData) {
        if (item.post_id) likedPostIds.add(item.post_id);
      }
    }
  }

  return sortPostsWithPinnedFirst(
    rows.map((row) => mapRawPost(row, likedPostIds))
  );
}

export async function fetchPostById(
  postId: string,
  currentUserId?: string | null
): Promise<PostRecord | null> {
  let rawRow: RawPostRow | null = null;

  const withPinResult = await supabase
    .from('posts')
    .select(POST_SELECT_WITH_PIN)
    .eq('id', postId)
    .maybeSingle();

  if (withPinResult.error) {
    if (isMissingPinColumnError(withPinResult.error.message)) {
      const fallbackResult = await supabase
        .from('posts')
        .select(POST_SELECT_BASE)
        .eq('id', postId)
        .maybeSingle();

      if (fallbackResult.error) {
        throw new Error(fallbackResult.error.message);
      }
      rawRow = (fallbackResult.data as unknown as RawPostRow | null) ?? null;
    } else {
      throw new Error(withPinResult.error.message);
    }
  } else {
    rawRow = (withPinResult.data as unknown as RawPostRow | null) ?? null;
  }

  if (!rawRow) return null;

  const likedPostIds = new Set<string>();
  if (currentUserId) {
    const { data: likeRow } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', currentUserId)
      .eq('post_id', postId)
      .maybeSingle();

    if (likeRow?.post_id) {
      likedPostIds.add(likeRow.post_id);
    }
  }

  return mapRawPost(rawRow, likedPostIds);
}

export async function togglePostLike(
  postId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<void> {
  if (currentlyLiked) {
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await supabase.from('post_likes').insert({
      post_id: postId,
      user_id: userId,
    });

    if (error && error.code !== '23505') {
      throw new Error(error.message);
    }
  }
}

export async function togglePostPin(
  postId: string,
  nextPinned: boolean
): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .update({ is_pinned: nextPinned })
    .eq('id', postId);

  if (error) {
    if (isMissingPinColumnError(error.message)) {
      throw new Error(
        'Falta la columna is_pinned en la tabla posts. Ejecuta el SQL de configuración en Supabase para activar las publicaciones fijadas.'
      );
    }
    throw new Error(error.message);
  }
}

export async function updatePost(params: {
  postId: string;
  userId: string;
  isOwner: boolean;
  category: string;
  title: string | null;
  content: string;
}): Promise<void> {
  let query = supabase
    .from('posts')
    .update({
      category: params.category,
      title: params.title,
      content: params.content,
    })
    .eq('id', params.postId);

  if (!params.isOwner) {
    query = query.eq('author_id', params.userId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }
}

export async function uploadPostImage(
  file: File,
  userId: string
): Promise<string> {
  const fileExt = ALLOWED_IMAGE_TYPES[file.type];
  if (!fileExt) {
    throw new Error(
      'Formato de imagen no permitido. Usa JPG, PNG, WebP o GIF.'
    );
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(
      'La imagen supera el límite de 5 MB. Elige un archivo más liviano.'
    );
  }

  const filePath = `${userId}/post-${Date.now()}.${fileExt}`;
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);

  if (!isSafeHttpUrl(publicUrl)) {
    throw new Error('No se pudo obtener una URL válida para la imagen subida.');
  }

  return publicUrl;
}

export async function createPost(params: {
  authorId: string;
  mode: PostMode;
  category: string;
  title: string | null;
  content: string;
  imageUrl: string | null;
}): Promise<string> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: params.authorId,
      mode: params.mode,
      category: params.category,
      title: params.title,
      content: params.content,
      image_url: params.imageUrl,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id as string;
}

export async function deletePost(
  postId: string,
  userId: string,
  isOwner = false
): Promise<void> {
  let query = supabase.from('posts').delete().eq('id', postId);
  if (!isOwner) {
    query = query.eq('author_id', userId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchCommentsForPost(
  postId: string
): Promise<CommentRecord[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(
      'id, post_id, author_id, parent_id, content, created_at, author:profiles(id, username, avatar_url, role)'
    )
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as RawCommentRow[];
  return rows.map((row) => ({
    id: row.id,
    post_id: row.post_id,
    author_id: row.author_id,
    parent_id: row.parent_id ?? null,
    content: row.content,
    created_at: row.created_at,
    author: normalizeAuthor(row.author),
  }));
}

export async function createComment(params: {
  postId: string;
  authorId: string;
  content: string;
  parentId?: string | null;
}): Promise<CommentRecord> {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: params.postId,
      author_id: params.authorId,
      content: params.content,
      parent_id: params.parentId ?? null,
    })
    .select(
      'id, post_id, author_id, parent_id, content, created_at, author:profiles(id, username, avatar_url, role)'
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as unknown as RawCommentRow;
  return {
    id: row.id,
    post_id: row.post_id,
    author_id: row.author_id,
    parent_id: row.parent_id ?? null,
    content: row.content,
    created_at: row.created_at,
    author: normalizeAuthor(row.author),
  };
}

export async function deleteComment(
  commentId: string,
  userId: string,
  isOwner = false
): Promise<void> {
  let query = supabase.from('comments').delete().eq('id', commentId);
  if (!isOwner) {
    query = query.eq('author_id', userId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchOwnerStats(): Promise<OwnerPlatformStats> {
  const [usersRes, postsRes, commentsRes] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('posts').select('*', { count: 'exact', head: true }),
    supabase.from('comments').select('*', { count: 'exact', head: true }),
  ]);

  if (usersRes.error) throw new Error(usersRes.error.message);
  if (postsRes.error) throw new Error(postsRes.error.message);
  if (commentsRes.error) throw new Error(commentsRes.error.message);

  return {
    totalUsers: usersRes.count ?? 0,
    totalPosts: postsRes.count ?? 0,
    totalComments: commentsRes.count ?? 0,
  };
}

export function buildCommentTree(comments: CommentRecord[]): CommentNode[] {
  const nodeMap = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const comment of comments) {
    nodeMap.set(comment.id, { ...comment, replies: [] });
  }

  for (const comment of comments) {
    const node = nodeMap.get(comment.id)!;
    if (comment.parent_id && nodeMap.has(comment.parent_id)) {
      nodeMap.get(comment.parent_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function formatEditorialDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return 'Ahora';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;

  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function estimateReadMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function getAuthorDisplayName(author: PostAuthor | null): string {
  const name = author?.username?.trim();
  return name && name.length > 0 ? name : 'Usuario de Trama';
}
