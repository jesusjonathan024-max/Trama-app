import {
  fetchSeriesCatalog,
  type ChapterRecord,
  type SeriesRecord,
} from './library';
import type { PostRecord } from './posts';
import { fetchPostsByIds } from './social';
import { isSafeHttpUrl, supabase } from './supabase';

export interface ReadingHistoryPostItem {
  id: string;
  kind: 'post';
  last_read_at: string;
  post: PostRecord;
}

export interface ReadingHistoryChapterItem {
  id: string;
  kind: 'chapter';
  last_read_at: string;
  series: SeriesRecord;
  chapter: ChapterRecord;
}

export type ReadingHistoryItem =
  | ReadingHistoryPostItem
  | ReadingHistoryChapterItem;

interface RawReadingHistoryRow {
  id: string;
  user_id: string;
  post_id: string | null;
  series_id: string | null;
  chapter_id: string | null;
  last_read_at: string;
}

interface RawChapterRow {
  id: string;
  series_id: string;
  chapter_number: number | string;
  title: string | null;
  text_content: string | null;
  image_urls: unknown;
  created_at: string;
}

export async function recordPostReadingHistory(
  userId: string,
  postId: string
): Promise<void> {
  if (!userId || !postId) return;
  const nowIso = new Date().toISOString();

  const { data: existingRows, error: lookupError } = await supabase
    .from('reading_history')
    .select('id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .limit(1);

  if (lookupError) {
    console.warn('Error consultando historial de lectura:', lookupError.message);
    return;
  }

  const existing = existingRows?.[0] as { id: string } | undefined;
  if (existing) {
    const { error: updateErr } = await supabase
      .from('reading_history')
      .update({ last_read_at: nowIso })
      .eq('id', existing.id);
    if (updateErr) {
      console.warn('Error actualizando historial de lectura:', updateErr.message);
    }
    return;
  }

  const { error: insertErr } = await supabase.from('reading_history').insert({
    user_id: userId,
    post_id: postId,
    series_id: null,
    chapter_id: null,
    last_read_at: nowIso,
  });

  if (insertErr && insertErr.code === '23505') {
    await supabase
      .from('reading_history')
      .update({ last_read_at: nowIso })
      .eq('user_id', userId)
      .eq('post_id', postId);
  }
}

export async function recordChapterReadingHistory(
  userId: string,
  seriesId: string,
  chapterId: string
): Promise<void> {
  if (!userId || !seriesId || !chapterId) return;
  const nowIso = new Date().toISOString();

  const { data: existingRows, error: lookupError } = await supabase
    .from('reading_history')
    .select('id')
    .eq('user_id', userId)
    .eq('series_id', seriesId)
    .limit(1);

  if (lookupError) {
    console.warn('Error consultando historial de capítulos:', lookupError.message);
    return;
  }

  const existing = existingRows?.[0] as { id: string } | undefined;
  if (existing) {
    const { error: updateErr } = await supabase
      .from('reading_history')
      .update({ chapter_id: chapterId, last_read_at: nowIso })
      .eq('id', existing.id);
    if (updateErr) {
      console.warn('Error actualizando historial de capítulos:', updateErr.message);
    }
    return;
  }

  const { error: insertErr } = await supabase.from('reading_history').insert({
    user_id: userId,
    post_id: null,
    series_id: seriesId,
    chapter_id: chapterId,
    last_read_at: nowIso,
  });

  if (insertErr && insertErr.code === '23505') {
    await supabase
      .from('reading_history')
      .update({ chapter_id: chapterId, last_read_at: nowIso })
      .eq('user_id', userId)
      .eq('series_id', seriesId);
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
    new Set(
      rows
        .map((r) => r.post_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  );
  const chapterIds = Array.from(
    new Set(
      rows
        .map((r) => r.chapter_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  );
  const hasSeries = rows.some((r) => Boolean(r.series_id));

  const [postsList, seriesCatalog, chaptersRes] = await Promise.all([
    postIds.length > 0
      ? fetchPostsByIds(postIds, userId).catch(() => [])
      : Promise.resolve([]),
    hasSeries ? fetchSeriesCatalog().catch(() => []) : Promise.resolve([]),
    chapterIds.length > 0
      ? supabase
          .from('chapters')
          .select(
            'id, series_id, chapter_number, title, text_content, image_urls, created_at'
          )
          .in('id', chapterIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const postMap = new Map<string, PostRecord>(postsList.map((p) => [p.id, p]));
  const seriesMap = new Map<string, SeriesRecord>(
    seriesCatalog.map((s) => [s.id, s])
  );
  const chapterMap = new Map<string, ChapterRecord>();

  if (!chaptersRes.error && chaptersRes.data) {
    for (const raw of chaptersRes.data as RawChapterRow[]) {
      const urls = Array.isArray(raw.image_urls)
        ? raw.image_urls.filter(
            (item): item is string =>
              typeof item === 'string' && isSafeHttpUrl(item)
          )
        : [];
      chapterMap.set(raw.id, {
        id: raw.id,
        series_id: raw.series_id,
        chapter_number:
          typeof raw.chapter_number === 'number'
            ? raw.chapter_number
            : Number(raw.chapter_number) || 0,
        title: raw.title ?? null,
        text_content: raw.text_content ?? null,
        image_urls: urls,
        created_at: raw.created_at,
      });
    }
  }

  const hydrated: ReadingHistoryItem[] = [];
  for (const row of rows) {
    if (row.post_id) {
      const post = postMap.get(row.post_id);
      if (post) {
        hydrated.push({
          id: row.id,
          kind: 'post',
          last_read_at: row.last_read_at,
          post,
        });
      }
    } else if (row.series_id && row.chapter_id) {
      const series = seriesMap.get(row.series_id);
      const chapter = chapterMap.get(row.chapter_id);
      if (series && chapter) {
        hydrated.push({
          id: row.id,
          kind: 'chapter',
          last_read_at: row.last_read_at,
          series,
          chapter,
        });
      }
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

export async function countReadingHistory(userId: string): Promise<number> {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('reading_history')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) return 0;
  return count ?? 0;
}
