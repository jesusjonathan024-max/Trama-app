import { supabase } from './supabase';
import type { PostAuthor } from './posts';

export interface SeriesRatingSummary {
  average: number;
  count: number;
  userRating: number | null;
}

export interface WriterStats {
  totalArticles: number;
  totalCommunityPosts: number;
  totalSeries: number;
  totalChapters: number;
  averageRating: number | null;
  totalRatingsCount: number;
  totalFollowers: number;
  totalViews: number;
}

export type ReportStatus = 'pending' | 'reviewed' | 'dismissed';

export const REPORT_REASONS = [
  'Información falsa o engañosa',
  'Fuente no verificable o manipulada',
  'Spam o contenido promocional engañoso',
  'Contenido inapropiado o acoso',
  'Otro motivo',
] as const;

export interface ReportedPostPreview {
  id: string;
  title: string | null;
  content: string;
  mode: 'actualidad' | 'comunidad';
  category: string;
  author_id: string;
}

export interface ContentReportRecord {
  id: string;
  post_id: string;
  reporter_id: string;
  reason: string;
  status: string;
  created_at: string;
  reporter: PostAuthor | null;
  post: ReportedPostPreview | null;
}

// ---------- Calificaciones con Estrellas (public.series_ratings) ----------

export async function fetchRatingsSummaryMap(
  seriesIds?: string[],
  currentUserId?: string | null
): Promise<Record<string, SeriesRatingSummary>> {
  let query = supabase
    .from('series_ratings')
    .select('series_id, user_id, rating');

  if (seriesIds && seriesIds.length > 0) {
    query = query.in('series_id', seriesIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const accum = new Map<
    string,
    { sum: number; count: number; userRating: number | null }
  >();

  for (const row of data ?? []) {
    const sid = row.series_id ? String(row.series_id) : '';
    const ratingVal = Number(row.rating);
    if (!sid || !Number.isFinite(ratingVal) || ratingVal < 1 || ratingVal > 5) {
      continue;
    }

    const entry = accum.get(sid) ?? { sum: 0, count: 0, userRating: null };
    entry.sum += ratingVal;
    entry.count += 1;
    if (currentUserId && String(row.user_id) === currentUserId) {
      entry.userRating = ratingVal;
    }
    accum.set(sid, entry);
  }

  const result: Record<string, SeriesRatingSummary> = {};
  for (const [sid, stats] of accum.entries()) {
    result[sid] = {
      average: stats.count > 0 ? stats.sum / stats.count : 0,
      count: stats.count,
      userRating: stats.userRating,
    };
  }

  return result;
}

export async function fetchSingleSeriesRating(
  seriesId: string,
  currentUserId?: string | null
): Promise<SeriesRatingSummary> {
  const map = await fetchRatingsSummaryMap([seriesId], currentUserId);
  return (
    map[seriesId] ?? {
      average: 0,
      count: 0,
      userRating: null,
    }
  );
}

export async function upsertSeriesRating(
  seriesId: string,
  userId: string,
  rating: number
): Promise<void> {
  const cleanRating = Math.round(rating);
  if (cleanRating < 1 || cleanRating > 5) {
    throw new Error('La calificación debe estar entre 1 y 5 estrellas.');
  }

  const now = new Date().toISOString();

  const { error } = await supabase.from('series_ratings').upsert(
    {
      series_id: seriesId,
      user_id: userId,
      rating: cleanRating,
      updated_at: now,
    },
    { onConflict: 'series_id,user_id' }
  );

  if (!error) return;

  if (error.code === '42P10') {
    const { data: existing } = await supabase
      .from('series_ratings')
      .select('id')
      .eq('series_id', seriesId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from('series_ratings')
        .update({ rating: cleanRating, updated_at: now })
        .eq('id', existing.id);
      if (updErr) throw new Error(updErr.message);
      return;
    }

    const { error: insErr } = await supabase.from('series_ratings').insert({
      series_id: seriesId,
      user_id: userId,
      rating: cleanRating,
      updated_at: now,
    });
    if (insErr) throw new Error(insErr.message);
    return;
  }

  throw new Error(error.message);
}

// ---------- Estadísticas de Escritor ----------

export async function fetchWriterStats(authorId: string): Promise<WriterStats> {
  const [postsRes, seriesRes, followersRes] = await Promise.all([
    supabase
      .from('posts')
      .select('id, mode, views_count')
      .eq('author_id', authorId),
    supabase.from('series').select('id').eq('author_id', authorId),
    supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', authorId),
  ]);

  if (postsRes.error) throw new Error(postsRes.error.message);
  if (seriesRes.error) throw new Error(seriesRes.error.message);
  if (followersRes.error) throw new Error(followersRes.error.message);

  const posts = postsRes.data ?? [];
  let totalArticles = 0;
  let totalCommunityPosts = 0;
  let totalViews = 0;

  for (const post of posts) {
    if (post.mode === 'actualidad') {
      totalArticles += 1;
    } else {
      totalCommunityPosts += 1;
    }
    const views = Number(post.views_count ?? 0);
    if (Number.isFinite(views) && views > 0) {
      totalViews += views;
    }
  }

  const seriesIds = (seriesRes.data ?? [])
    .map((s) => String(s.id ?? ''))
    .filter(Boolean);

  let totalChapters = 0;
  let averageRating: number | null = null;
  let totalRatingsCount = 0;

  if (seriesIds.length > 0) {
    const [chaptersRes, ratingsRes] = await Promise.all([
      supabase
        .from('chapters')
        .select('*', { count: 'exact', head: true })
        .in('series_id', seriesIds),
      supabase
        .from('series_ratings')
        .select('rating')
        .in('series_id', seriesIds),
    ]);

    if (!chaptersRes.error) {
      totalChapters = chaptersRes.count ?? 0;
    }

    if (!ratingsRes.error && ratingsRes.data && ratingsRes.data.length > 0) {
      let sum = 0;
      let validCount = 0;
      for (const row of ratingsRes.data) {
        const val = Number(row.rating);
        if (Number.isFinite(val) && val >= 1 && val <= 5) {
          sum += val;
          validCount += 1;
        }
      }
      if (validCount > 0) {
        averageRating = sum / validCount;
        totalRatingsCount = validCount;
      }
    }
  }

  return {
    totalArticles,
    totalCommunityPosts,
    totalSeries: seriesIds.length,
    totalChapters,
    averageRating,
    totalRatingsCount,
    totalFollowers: followersRes.count ?? 0,
    totalViews,
  };
}

// ---------- Reportes de Contenido (public.content_reports) ----------

export function isReportPendingStatus(status: string | null | undefined): boolean {
  const s = (status ?? '').trim().toLowerCase();
  return s === '' || s === 'pending' || s === 'pendiente' || s === 'open';
}

export function formatReportStatusLabel(status: string | null | undefined): string {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'reviewed' || s === 'revisado' || s === 'resolved') {
    return 'Revisado';
  }
  if (s === 'dismissed' || s === 'descartado' || s === 'rejected') {
    return 'Descartado';
  }
  return 'Pendiente';
}

export async function fetchUserReportedPostIds(
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('content_reports')
    .select('post_id')
    .eq('reporter_id', userId);

  if (error) {
    return [];
  }

  return (data ?? [])
    .map((row) => (row.post_id ? String(row.post_id) : ''))
    .filter(Boolean);
}

export async function submitContentReport(params: {
  postId: string;
  reporterId: string;
  reason: string;
}): Promise<void> {
  const cleanReason = params.reason.trim();
  if (cleanReason.length < 4) {
    throw new Error('Selecciona o describe el motivo del reporte.');
  }

  // Verificar duplicado por usuario y publicación antes de insertar
  const { data: existing } = await supabase
    .from('content_reports')
    .select('id')
    .eq('post_id', params.postId)
    .eq('reporter_id', params.reporterId)
    .maybeSingle();

  if (existing?.id) {
    throw new Error('Ya enviaste un reporte para esta publicación.');
  }

  const candidateStatuses = ['pending', 'pendiente'];
  let lastError: string | null = null;

  for (const statusValue of candidateStatuses) {
    const { error } = await supabase.from('content_reports').insert({
      post_id: params.postId,
      reporter_id: params.reporterId,
      reason: cleanReason.slice(0, 500),
      status: statusValue,
    });

    if (!error) return;

    if (error.code === '23505') {
      throw new Error('Ya enviaste un reporte para esta publicación.');
    }

    lastError = error.message;
    if (error.code !== '23514') {
      break;
    }
  }

  throw new Error(
    lastError || 'No se pudo enviar el reporte en este momento.'
  );
}

export async function fetchContentReports(): Promise<ContentReportRecord[]> {
  const { data, error } = await supabase
    .from('content_reports')
    .select('id, post_id, reporter_id, reason, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const reporterIds = Array.from(
    new Set(rows.map((r) => String(r.reporter_id ?? '')).filter(Boolean))
  );
  const postIds = Array.from(
    new Set(rows.map((r) => String(r.post_id ?? '')).filter(Boolean))
  );

  const [profilesRes, postsRes] = await Promise.all([
    reporterIds.length > 0
      ? supabase
          .from('profiles')
          .select('id, username, avatar_url, role, badge')
          .in('id', reporterIds)
      : Promise.resolve({ data: [], error: null }),
    postIds.length > 0
      ? supabase
          .from('posts')
          .select('id, title, content, mode, category, author_id')
          .in('id', postIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profileMap = new Map<string, PostAuthor>();
  for (const p of profilesRes.data ?? []) {
    profileMap.set(String(p.id), {
      id: String(p.id),
      username: p.username ?? null,
      avatar_url: p.avatar_url ?? null,
      role: p.role ?? null,
      badge: p.badge ?? null,
    });
  }

  const postMap = new Map<string, ReportedPostPreview>();
  for (const post of postsRes.data ?? []) {
    postMap.set(String(post.id), {
      id: String(post.id),
      title: post.title ?? null,
      content: post.content ?? '',
      mode: post.mode === 'comunidad' ? 'comunidad' : 'actualidad',
      category: post.category ?? '',
      author_id: String(post.author_id ?? ''),
    });
  }

  return rows.map((row) => ({
    id: String(row.id),
    post_id: String(row.post_id),
    reporter_id: String(row.reporter_id),
    reason: String(row.reason ?? ''),
    status: String(row.status ?? 'pending'),
    created_at: String(row.created_at),
    reporter: profileMap.get(String(row.reporter_id)) ?? null,
    post: postMap.get(String(row.post_id)) ?? null,
  }));
}

export async function updateContentReportStatus(
  reportId: string,
  nextStatus: 'reviewed' | 'dismissed'
): Promise<string> {
  const candidates =
    nextStatus === 'reviewed'
      ? ['reviewed', 'revisado', 'resolved']
      : ['dismissed', 'descartado', 'rejected'];

  let lastError: string | null = null;

  for (const statusValue of candidates) {
    const { error } = await supabase
      .from('content_reports')
      .update({ status: statusValue })
      .eq('id', reportId);

    if (!error) return statusValue;

    lastError = error.message;
    if (error.code !== '23514') {
      break;
    }
  }

  throw new Error(
    lastError || 'No se pudo actualizar el estado del reporte.'
  );
}
