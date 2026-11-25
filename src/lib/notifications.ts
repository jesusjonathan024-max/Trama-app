import { supabase } from './supabase';
import type { PostMode } from './posts';

export type NotificationKind = 'comment' | 'like';

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  postId: string;
  postTitle: string;
  postMode: PostMode;
  actorId: string;
  actorName: string;
  actorAvatar: string | null;
  actorRole: string | null;
  actorBadge: string | null;
  excerpt: string | null;
  createdAt: string;
  isUnread: boolean;
}

const SEEN_STORAGE_PREFIX = 'trama_notifications_seen_';

export function getNotificationsSeenAt(userId: string): number {
  try {
    const raw = localStorage.getItem(`${SEEN_STORAGE_PREFIX}${userId}`);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export function markNotificationsSeenNow(userId: string): number {
  const now = Date.now();
  try {
    localStorage.setItem(`${SEEN_STORAGE_PREFIX}${userId}`, String(now));
  } catch {
    // Ignora si el almacenamiento local no está disponible
  }
  return now;
}

interface OwnedPostSummary {
  id: string;
  title: string | null;
  content: string;
  mode: string;
}

interface ActorProfileRow {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  badge: string | null;
}

export async function fetchUserNotifications(
  userId: string,
  limit = 20
): Promise<NotificationItem[]> {
  const { data: myPosts, error: postsError } = await supabase
    .from('posts')
    .select('id, title, content, mode')
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (postsError) {
    throw new Error(postsError.message);
  }

  const ownedPosts = (myPosts ?? []) as OwnedPostSummary[];
  if (ownedPosts.length === 0) {
    return [];
  }

  const postMap = new Map<string, { title: string; mode: PostMode }>();
  const postIds: string[] = [];

  for (const post of ownedPosts) {
    postIds.push(post.id);
    const cleanedTitle =
      post.title?.trim() ||
      post.content.trim().slice(0, 64) +
        (post.content.trim().length > 64 ? '…' : '');
    postMap.set(post.id, {
      title: cleanedTitle || 'Tu publicación',
      mode: post.mode === 'comunidad' ? 'comunidad' : 'actualidad',
    });
  }

  const [commentsRes, likesRes] = await Promise.all([
    supabase
      .from('comments')
      .select('id, post_id, author_id, content, created_at')
      .in('post_id', postIds)
      .neq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('post_likes')
      .select('post_id, user_id, created_at')
      .in('post_id', postIds)
      .neq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  const rawComments = commentsRes.error ? [] : commentsRes.data ?? [];
  const rawLikes = likesRes.error ? [] : likesRes.data ?? [];

  const actorIds = new Set<string>();
  for (const row of rawComments) {
    if (row.author_id) actorIds.add(String(row.author_id));
  }
  for (const row of rawLikes) {
    if (row.user_id) actorIds.add(String(row.user_id));
  }

  const actorMap = new Map<string, ActorProfileRow>();
  if (actorIds.size > 0) {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, role, badge')
      .in('id', Array.from(actorIds));

    for (const row of (profilesData ?? []) as ActorProfileRow[]) {
      actorMap.set(row.id, row);
    }
  }

  const lastSeenAt = getNotificationsSeenAt(userId);
  const items: NotificationItem[] = [];

  for (const row of rawComments) {
    const postInfo = postMap.get(row.post_id);
    if (!postInfo) continue;
    const actor = actorMap.get(row.author_id);
    const ts = new Date(row.created_at).getTime();
    items.push({
      id: `comment-${row.id}`,
      kind: 'comment',
      postId: row.post_id,
      postTitle: postInfo.title,
      postMode: postInfo.mode,
      actorId: row.author_id,
      actorName: actor?.username?.trim() || 'Usuario de Trama',
      actorAvatar: actor?.avatar_url ?? null,
      actorRole: actor?.role ?? null,
      actorBadge: actor?.badge ?? null,
      excerpt: (row.content ?? '').trim().slice(0, 96) || null,
      createdAt: row.created_at,
      isUnread: Number.isFinite(ts) ? ts > lastSeenAt : false,
    });
  }

  for (const row of rawLikes) {
    const postInfo = postMap.get(row.post_id);
    if (!postInfo) continue;
    const actor = actorMap.get(row.user_id);
    const createdAt = row.created_at || new Date().toISOString();
    const ts = new Date(createdAt).getTime();
    items.push({
      id: `like-${row.post_id}-${row.user_id}`,
      kind: 'like',
      postId: row.post_id,
      postTitle: postInfo.title,
      postMode: postInfo.mode,
      actorId: row.user_id,
      actorName: actor?.username?.trim() || 'Usuario de Trama',
      actorAvatar: actor?.avatar_url ?? null,
      actorRole: actor?.role ?? null,
      actorBadge: actor?.badge ?? null,
      excerpt: null,
      createdAt,
      isUnread: Number.isFinite(ts) ? ts > lastSeenAt : false,
    });
  }

  items.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return items.slice(0, limit);
}
