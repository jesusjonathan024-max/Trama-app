import { MEDIA_BUCKET, isSafeHttpUrl, supabase } from './supabase';
import {
  MAX_IMAGE_SIZE_BYTES,
  type PostAuthor,
} from './posts';

export type SeriesType = 'novela' | 'manhwa';
export type SeriesStatus = 'En emisión' | 'Finalizado';

export const SERIES_GENRES = [
  'Fantasía',
  'Acción',
  'Romance',
  'Sci-Fi',
  'Aventura',
  'Drama',
  'Misterio',
  'Recuentos de la vida',
] as const;

export const SERIES_STATUSES: SeriesStatus[] = ['En emisión', 'Finalizado'];

export const MAX_CHAPTER_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;

const SAFE_IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/bmp': 'bmp',
};

const SAFE_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'avif',
  'heic',
  'heif',
  'bmp',
]);

export function isManhwaType(type: string | null | undefined): boolean {
  return (type ?? '').trim().toLowerCase() === 'manhwa';
}

export function generateUniqueFileId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function resolveSafeImageMeta(file: File): {
  ext: string;
  contentType: string;
} | null {
  const mime = (file.type || '').trim().toLowerCase();

  // Bloquea SVG por seguridad XSS
  if (mime === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return null;
  }

  if (mime && SAFE_IMAGE_MIME_TO_EXT[mime]) {
    return {
      ext: SAFE_IMAGE_MIME_TO_EXT[mime],
      contentType: mime === 'image/jpg' ? 'image/jpeg' : mime,
    };
  }

  // Algunos navegadores móviles devuelven MIME vacío o genérico image/*
  const rawExt = file.name.split('.').pop()?.trim().toLowerCase() ?? '';
  if (SAFE_IMAGE_EXTENSIONS.has(rawExt)) {
    const normalizedExt = rawExt === 'jpeg' ? 'jpg' : rawExt;
    return {
      ext: normalizedExt,
      contentType:
        mime.startsWith('image/')
          ? mime
          : normalizedExt === 'jpg'
            ? 'image/jpeg'
            : `image/${normalizedExt}`,
    };
  }

  if (mime.startsWith('image/')) {
    return {
      ext: 'jpg',
      contentType: mime,
    };
  }

  return null;
}

export interface SeriesRecord {
  id: string;
  author_id: string;
  title: string;
  type: SeriesType;
  genre: string;
  status: string;
  synopsis: string;
  cover_url: string | null;
  created_at: string;
  author: PostAuthor | null;
  chapters_count: number;
}

export interface ChapterRecord {
  id: string;
  series_id: string;
  chapter_number: number;
  title: string | null;
  text_content: string | null;
  image_urls: string[];
  created_at: string;
}

export type NovelReaderTheme = 'oscuro' | 'sepia' | 'claro';

export interface NovelReaderPrefs {
  fontSize: number;
  theme: NovelReaderTheme;
}

export interface ReadingProgressEntry {
  chapterId: string;
  chapterNumber: number;
  updatedAt: number;
}

interface RawCountItem {
  count?: number;
}

interface RawSeriesRow {
  id: string;
  author_id: string;
  title: string;
  type: string;
  genre: string | null;
  status: string | null;
  synopsis: string | null;
  cover_url: string | null;
  created_at: string;
  author: PostAuthor | PostAuthor[] | null;
  chapters: RawCountItem[] | null;
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

function normalizeAuthor(
  raw: PostAuthor | PostAuthor[] | null | undefined
): PostAuthor | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function extractCount(items: RawCountItem[] | null | undefined): number {
  if (!Array.isArray(items) || items.length === 0) return 0;
  const val = items[0]?.count;
  return typeof val === 'number' ? val : 0;
}

function normalizeImageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is string => typeof item === 'string' && isSafeHttpUrl(item)
  );
}

function mapRawSeries(row: RawSeriesRow): SeriesRecord {
  return {
    id: row.id,
    author_id: row.author_id,
    title: row.title,
    type: isManhwaType(row.type) ? 'manhwa' : 'novela',
    genre: row.genre?.trim() || 'Fantasía',
    status: row.status?.trim() || 'En emisión',
    synopsis: row.synopsis ?? '',
    cover_url: row.cover_url ?? null,
    created_at: row.created_at,
    author: normalizeAuthor(row.author),
    chapters_count: extractCount(row.chapters),
  };
}

function mapRawChapter(row: RawChapterRow): ChapterRecord {
  const numericChapter =
    typeof row.chapter_number === 'number'
      ? row.chapter_number
      : Number(row.chapter_number) || 0;

  return {
    id: row.id,
    series_id: row.series_id,
    chapter_number: numericChapter,
    title: row.title ?? null,
    text_content: row.text_content ?? null,
    image_urls: normalizeImageUrls(row.image_urls),
    created_at: row.created_at,
  };
}

const SERIES_SELECT = `
  id,
  author_id,
  title,
  type,
  genre,
  status,
  synopsis,
  cover_url,
  created_at,
  author:profiles(id, username, avatar_url, role),
  chapters(count)
`;

export async function fetchSeriesCatalog(): Promise<SeriesRecord[]> {
  const { data, error } = await supabase
    .from('series')
    .select(SERIES_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as RawSeriesRow[];
  return rows.map(mapRawSeries);
}

export async function fetchSeriesById(
  seriesId: string
): Promise<SeriesRecord | null> {
  const { data, error } = await supabase
    .from('series')
    .select(SERIES_SELECT)
    .eq('id', seriesId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;
  return mapRawSeries(data as unknown as RawSeriesRow);
}

export async function fetchChaptersBySeries(
  seriesId: string
): Promise<ChapterRecord[]> {
  const { data, error } = await supabase
    .from('chapters')
    .select(
      'id, series_id, chapter_number, title, text_content, image_urls, created_at'
    )
    .eq('series_id', seriesId)
    .order('chapter_number', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as RawChapterRow[];
  return rows.map(mapRawChapter);
}

export async function uploadSeriesCover(
  file: File,
  userId: string
): Promise<string> {
  const meta = resolveSafeImageMeta(file);
  if (!meta) {
    throw new Error(
      'Formato de portada no permitido. Usa una imagen JPG, PNG, WebP, GIF o AVIF.'
    );
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(
      'La portada supera el límite de 5 MB. Elige un archivo más liviano.'
    );
  }

  const filePath = `${userId}/series-cover-${generateUniqueFileId()}.${meta.ext}`;
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: meta.contentType,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);

  if (!isSafeHttpUrl(publicUrl)) {
    throw new Error('No se pudo obtener una URL válida para la portada.');
  }

  return publicUrl;
}

export async function createSeries(params: {
  authorId: string;
  title: string;
  type: SeriesType;
  genre: string;
  status: SeriesStatus;
  synopsis: string;
  coverUrl: string | null;
}): Promise<SeriesRecord> {
  const { data, error } = await supabase
    .from('series')
    .insert({
      author_id: params.authorId,
      title: params.title,
      type: params.type,
      genre: params.genre,
      status: params.status,
      synopsis: params.synopsis,
      cover_url: params.coverUrl,
    })
    .select(SERIES_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRawSeries(data as unknown as RawSeriesRow);
}

export async function deleteSeries(
  seriesId: string,
  userId: string,
  isOwner = false
): Promise<void> {
  let query = supabase.from('series').delete().eq('id', seriesId);
  if (!isOwner) {
    query = query.eq('author_id', userId);
  }
  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }
}

export async function uploadChapterPages(
  files: File[],
  userId: string,
  seriesId: string,
  chapterNumber: number,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  if (files.length === 0) {
    throw new Error('Selecciona al menos una imagen para el capítulo.');
  }

  const validatedMeta: { ext: string; contentType: string }[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const meta = resolveSafeImageMeta(file);
    if (!meta) {
      throw new Error(
        `La página ${i + 1} (${file.name}) no es una imagen compatible.`
      );
    }
    if (file.size > MAX_CHAPTER_IMAGE_SIZE_BYTES) {
      throw new Error(
        `La página ${i + 1} (${file.name}) supera el límite de 15 MB por imagen.`
      );
    }
    validatedMeta.push(meta);
  }

  const uploadedUrls: string[] = [];
  const safeChapterTag = String(chapterNumber).replace(/[^0-9a-zA-Z.-]/g, '_');

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const meta = validatedMeta[i];
    onProgress?.(i + 1, files.length);

    const pageOrder = String(i + 1).padStart(3, '0');
    const uniqueId = generateUniqueFileId();
    const filePath = `${userId}/chapter-${seriesId}-${safeChapterTag}-p${pageOrder}-${uniqueId}.${meta.ext}`;

    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: meta.contentType,
      });

    if (uploadError) {
      throw new Error(
        `Error al subir la página ${i + 1} al bucket media: ${uploadError.message}`
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);

    if (!isSafeHttpUrl(publicUrl)) {
      throw new Error(`No se obtuvo una URL válida para la página ${i + 1}.`);
    }

    uploadedUrls.push(publicUrl);
  }

  return uploadedUrls;
}

export async function createChapter(params: {
  seriesId: string;
  chapterNumber: number;
  title: string | null;
  textContent: string | null;
  imageUrls: string[] | null;
}): Promise<ChapterRecord> {
  const { data, error } = await supabase
    .from('chapters')
    .insert({
      series_id: params.seriesId,
      chapter_number: params.chapterNumber,
      title: params.title,
      text_content: params.textContent,
      image_urls: params.imageUrls,
    })
    .select(
      'id, series_id, chapter_number, title, text_content, image_urls, created_at'
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRawChapter(data as unknown as RawChapterRow);
}

export async function deleteChapter(chapterId: string): Promise<void> {
  const { error } = await supabase
    .from('chapters')
    .delete()
    .eq('id', chapterId);

  if (error) {
    throw new Error(error.message);
  }
}

export function formatChapterNumber(num: number): string {
  return Number.isInteger(num) ? String(num) : String(num);
}

const PROGRESS_STORAGE_KEY = 'trama_library_progress_v1';
const NOVEL_PREFS_STORAGE_KEY = 'trama_novel_reader_prefs_v1';

export function getReadingProgress(
  seriesId: string
): ReadingProgressEntry | null {
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, ReadingProgressEntry>;
    const entry = map[seriesId];
    if (
      entry &&
      typeof entry.chapterId === 'string' &&
      typeof entry.chapterNumber === 'number'
    ) {
      return entry;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveReadingProgress(
  seriesId: string,
  chapterId: string,
  chapterNumber: number
): void {
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    const map = raw
      ? (JSON.parse(raw) as Record<string, ReadingProgressEntry>)
      : {};
    map[seriesId] = {
      chapterId,
      chapterNumber,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignora fallos de almacenamiento privado/cuota
  }
}

export function getNovelReaderPrefs(): NovelReaderPrefs {
  try {
    const raw = window.localStorage.getItem(NOVEL_PREFS_STORAGE_KEY);
    if (!raw) return { fontSize: 18, theme: 'oscuro' };
    const parsed = JSON.parse(raw) as Partial<NovelReaderPrefs>;
    const fontSize =
      typeof parsed.fontSize === 'number'
        ? Math.min(24, Math.max(15, parsed.fontSize))
        : 18;
    const theme: NovelReaderTheme =
      parsed.theme === 'sepia' || parsed.theme === 'claro'
        ? parsed.theme
        : 'oscuro';
    return { fontSize, theme };
  } catch {
    return { fontSize: 18, theme: 'oscuro' };
  }
}

export function saveNovelReaderPrefs(prefs: NovelReaderPrefs): void {
  try {
    window.localStorage.setItem(NOVEL_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignora fallos de almacenamiento privado
  }
}
