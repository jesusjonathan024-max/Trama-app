import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  MAX_CHAPTER_IMAGE_SIZE_BYTES,
  createChapter,
  generateUniqueFileId,
  getSeriesTypeLabel,
  isMangaType,
  isVisualSeriesType,
  resolveSafeImageMeta,
  uploadChapterPages,
  type ChapterRecord,
  type SeriesRecord,
} from '../lib/library';
import { estimateReadMinutes } from '../lib/posts';
import { isSafeHttpUrl } from '../lib/supabase';

interface CreateChapterModalProps {
  isOpen: boolean;
  series: SeriesRecord;
  suggestedChapterNumber: number;
  onClose: () => void;
  onCreated: (chapter: ChapterRecord) => void;
}

type PendingPageItem =
  | {
      id: string;
      kind: 'file';
      file: File;
      previewUrl: string;
      label: string;
    }
  | {
      id: string;
      kind: 'url';
      url: string;
      previewUrl: string;
      label: string;
    };

const MAX_CHAPTER_TITLE_LENGTH = 140;

function extractShortUrlLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split('/').filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : parsed.hostname;
  } catch {
    return url;
  }
}

export function CreateChapterModal({
  isOpen,
  series,
  suggestedChapterNumber,
  onClose,
  onCreated,
}: CreateChapterModalProps) {
  const { user } = useAuth();
  const fileInputId = useId();

  const [chapterNumberInput, setChapterNumberInput] = useState(
    String(suggestedChapterNumber)
  );
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [pages, setPages] = useState<PendingPageItem[]>([]);
  const [urlDraft, setUrlDraft] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pagesRef = useRef<PendingPageItem[]>([]);
  const errorBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    return () => {
      for (const page of pagesRef.current) {
        if (page.kind === 'file') {
          URL.revokeObjectURL(page.previewUrl);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setChapterNumberInput(String(suggestedChapterNumber));
    setErrorMsg(null);
    setUploadProgress(null);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, suggestedChapterNumber, isSubmitting, onClose]);

  useEffect(() => {
    if (errorMsg && errorBoxRef.current) {
      errorBoxRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [errorMsg]);

  const wordCount = useMemo(() => {
    if (!textContent.trim()) return 0;
    return textContent.trim().split(/\s+/).filter(Boolean).length;
  }, [textContent]);

  if (!isOpen) return null;

  const isVisualSeries = isVisualSeriesType(series.type);
  const isManga = isMangaType(series.type);
  const seriesTypeLabel = getSeriesTypeLabel(series.type);

  function handleSelectPages(event: ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    setErrorMsg(null);
    const nextItems: PendingPageItem[] = [];
    const rejectedMessages: string[] = [];

    for (let i = 0; i < fileList.length; i += 1) {
      const file = fileList[i];
      const meta = resolveSafeImageMeta(file);
      if (!meta) {
        rejectedMessages.push(`"${file.name}" no es una imagen compatible.`);
        continue;
      }
      if (file.size > MAX_CHAPTER_IMAGE_SIZE_BYTES) {
        rejectedMessages.push(
          `"${file.name}" supera el límite de 15 MB por imagen.`
        );
        continue;
      }
      nextItems.push({
        id: generateUniqueFileId(),
        kind: 'file',
        file,
        previewUrl: URL.createObjectURL(file),
        label: file.name,
      });
    }

    event.target.value = '';

    if (rejectedMessages.length > 0) {
      setErrorMsg(rejectedMessages.join(' '));
    }

    if (nextItems.length > 0) {
      setPages((prev) => [...prev, ...nextItems]);
    }
  }

  function handleAddPageUrls() {
    const rawLines = urlDraft
      .split(/[\n,\s]+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (rawLines.length === 0) {
      setErrorMsg('Pega al menos una URL válida de imagen (https://…).');
      return;
    }

    const nextItems: PendingPageItem[] = [];
    const invalidCount: string[] = [];

    for (const candidate of rawLines) {
      if (!isSafeHttpUrl(candidate)) {
        invalidCount.push(candidate);
        continue;
      }
      nextItems.push({
        id: generateUniqueFileId(),
        kind: 'url',
        url: candidate,
        previewUrl: candidate,
        label: extractShortUrlLabel(candidate),
      });
    }

    if (invalidCount.length > 0) {
      setErrorMsg(
        `Se ignoraron ${invalidCount.length} enlaces inválidos. Usa URLs completas con https://`
      );
    } else {
      setErrorMsg(null);
    }

    if (nextItems.length > 0) {
      setPages((prev) => [...prev, ...nextItems]);
      setUrlDraft('');
    }
  }

  function movePage(index: number, direction: -1 | 1) {
    setPages((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  }

  function removePage(id: string) {
    setPages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target && target.kind === 'file') {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  }

  function clearAllPages() {
    for (const page of pages) {
      if (page.kind === 'file') {
        URL.revokeObjectURL(page.previewUrl);
      }
    }
    setPages([]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || user.id !== series.author_id) {
      setErrorMsg('Solo el creador de esta obra puede subir capítulos.');
      return;
    }

    setErrorMsg(null);
    const parsedNumber = Number(chapterNumberInput.replace(',', '.'));
    if (!Number.isFinite(parsedNumber) || parsedNumber < 0) {
      setErrorMsg('Ingresa un número de capítulo válido (ej. 1, 2 o 1.5).');
      return;
    }

    if (isVisualSeries) {
      if (pages.length === 0) {
        setErrorMsg(
          'Agrega al menos una página (desde galería o URL) antes de publicar el capítulo.'
        );
        return;
      }
    } else if (!textContent.trim()) {
      setErrorMsg('Escribe o pega el texto del capítulo antes de publicar.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(null);

    try {
      let finalUrls: string[] | null = null;
      if (isVisualSeries) {
        const fileEntries = pages
          .map((item, idx) => ({ item, idx }))
          .filter(
            (
              entry
            ): entry is {
              item: Extract<PendingPageItem, { kind: 'file' }>;
              idx: number;
            } => entry.item.kind === 'file'
          );

        const uploadedByIndex = new Map<number, string>();
        if (fileEntries.length > 0) {
          const uploadedUrls = await uploadChapterPages(
            fileEntries.map((entry) => entry.item.file),
            user.id,
            series.id,
            parsedNumber,
            (current, total) => setUploadProgress({ current, total })
          );
          fileEntries.forEach((entry, i) => {
            uploadedByIndex.set(entry.idx, uploadedUrls[i]);
          });
        }

        finalUrls = pages.map((page, idx) => {
          if (page.kind === 'url') return page.url;
          return uploadedByIndex.get(idx) ?? '';
        });
        finalUrls = finalUrls.filter((u) => u.length > 0);
      }

      const created = await createChapter({
        seriesId: series.id,
        chapterNumber: parsedNumber,
        title: title.trim() || null,
        textContent: isVisualSeries ? null : textContent.trim(),
        imageUrls: isVisualSeries ? finalUrls : null,
      });

      setTitle('');
      setTextContent('');
      setUrlDraft('');
      setShowUrlInput(false);
      clearAllPages();
      setUploadProgress(null);
      onClose();
      onCreated(created);
    } catch (err) {
      const detail =
        err instanceof Error && err.message
          ? err.message
          : 'Ocurrió un error desconocido al guardar el capítulo.';
      setErrorMsg(`No se pudo publicar el capítulo: ${detail}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-chapter-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl transition-colors duration-300 sm:rounded-2xl">
        <div className="shrink-0 border-b border-[var(--border-subtle)] px-5 pt-3 pb-4 sm:px-6 sm:pt-5">
          <div
            aria-hidden="true"
            className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden"
          />

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2
                id="create-chapter-title"
                className="font-display text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl"
              >
                Subir Capítulo
              </h2>
              <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                {series.title} · {seriesTypeLabel} (
                {isManga
                  ? 'páginas en lector paginado'
                  : isVisualSeries
                    ? 'scroll vertical continuo'
                    : 'texto'}
                )
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Cerrar formulario de capítulo"
              className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5"
          noValidate
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
            <div className="sm:col-span-4">
              <label
                htmlFor="chapter-number"
                className="mb-1.5 block text-sm font-medium text-[var(--text-main)]"
              >
                Número de capítulo
              </label>
              <input
                id="chapter-number"
                type="number"
                step="any"
                min="0"
                required
                value={chapterNumberInput}
                onChange={(event) => setChapterNumberInput(event.target.value)}
                className="min-h-[46px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 text-sm tabular-nums text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 transition-colors"
              />
            </div>

            <div className="sm:col-span-8">
              <label
                htmlFor="chapter-title"
                className="mb-1.5 block text-sm font-medium text-[var(--text-main)]"
              >
                Título del capítulo (opcional)
              </label>
              <input
                id="chapter-title"
                type="text"
                maxLength={MAX_CHAPTER_TITLE_LENGTH}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej. El primer encuentro"
                className="min-h-[46px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 transition-colors"
              />
            </div>
          </div>

          {!isVisualSeries ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label
                  htmlFor="chapter-text"
                  className="block text-sm font-medium text-[var(--text-main)]"
                >
                  Contenido del capítulo
                </label>
                <span className="text-xs tabular-nums text-[var(--text-muted)]">
                  {wordCount} palabras
                  {wordCount > 0
                    ? ` · ${estimateReadMinutes(textContent)} min`
                    : ''}
                </span>
              </div>
              <textarea
                id="chapter-text"
                rows={12}
                required
                value={textContent}
                onChange={(event) => setTextContent(event.target.value)}
                placeholder="Escribe o pega aquí el texto completo del capítulo. Los saltos de párrafo se conservarán en el lector…"
                className="w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3.5 text-sm leading-relaxed text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 transition-colors"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="block text-sm font-medium text-[var(--text-main)]">
                    Páginas del capítulo ({seriesTypeLabel})
                  </span>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Sube varias imágenes en orden o pega sus URLs y reordénalas
                    antes de publicar.
                  </p>
                </div>

                {pages.length > 0 && (
                  <span className="text-xs font-semibold tabular-nums text-[var(--accent-primary)]">
                    {pages.length}{' '}
                    {pages.length === 1 ? 'página' : 'páginas'}
                  </span>
                )}
              </div>

              <input
                id={fileInputId}
                type="file"
                accept="image/*"
                multiple
                disabled={isSubmitting}
                onChange={handleSelectPages}
                className="sr-only"
              />

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <label
                  htmlFor={fileInputId}
                  className={`min-h-[52px] flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--accent-primary)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer select-none ${
                    isSubmitting ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  <ImagePlus size={18} aria-hidden="true" />
                  <span>
                    {pages.length === 0
                      ? 'Subir imágenes'
                      : 'Añadir más imágenes'}
                  </span>
                </label>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowUrlInput((prev) => !prev)}
                  className={`min-h-[52px] inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    showUrlInput
                      ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  <Link2 size={17} aria-hidden="true" />
                  <span>Pegar URLs de páginas</span>
                </button>
              </div>

              {showUrlInput && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3.5 space-y-2.5">
                  <label
                    htmlFor="chapter-urls-input"
                    className="block text-xs font-semibold text-[var(--text-main)]"
                  >
                    URLs de imágenes (una por línea, en orden)
                  </label>
                  <textarea
                    id="chapter-urls-input"
                    rows={3}
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                    placeholder={
                      'https://ejemplo.com/pag-01.jpg\nhttps://ejemplo.com/pag-02.jpg'
                    }
                    className="w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUrlDraft('');
                        setShowUrlInput(false);
                      }}
                      className="min-h-[36px] rounded-lg px-3 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                    >
                      Cerrar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddPageUrls}
                      className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] transition-colors"
                    >
                      <Plus size={14} aria-hidden="true" />
                      <span>Agregar páginas</span>
                    </button>
                  </div>
                </div>
              )}

              {pages.length > 0 && (
                <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {pages.map((page, index) => (
                      <div
                        key={page.id}
                        className="flex flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]"
                      >
                        <div className="relative aspect-[3/4] w-full bg-[var(--bg-subtle)]">
                          <img
                            src={page.previewUrl}
                            alt={`Miniatura página ${index + 1}`}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute left-2 top-2 rounded-lg bg-black/80 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white backdrop-blur-sm">
                            Pág. {index + 1}
                          </span>
                          {page.kind === 'url' && (
                            <span className="absolute left-2 bottom-2 rounded-md bg-cyan-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              URL
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => removePage(page.id)}
                            aria-label={`Quitar página ${index + 1}`}
                            className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-black/75 text-red-300 hover:bg-red-600 hover:text-white disabled:opacity-40 transition-colors"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-1 border-t border-[var(--border-subtle)] px-2 py-1.5">
                          <span className="truncate text-[11px] text-[var(--text-secondary)]">
                            {page.label}
                          </span>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              disabled={index === 0 || isSubmitting}
                              onClick={() => movePage(index, -1)}
                              aria-label={`Mover página ${index + 1} antes`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] disabled:opacity-25 transition-colors"
                            >
                              <ArrowUp size={14} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              disabled={
                                index === pages.length - 1 || isSubmitting
                              }
                              onClick={() => movePage(index, 1)}
                              aria-label={`Mover página ${index + 1} después`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] disabled:opacity-25 transition-colors"
                            >
                              <ArrowDown size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2.5 text-xs text-[var(--text-secondary)]">
                    <span className="tabular-nums">
                      Total: {pages.length}{' '}
                      {pages.length === 1 ? 'página lista' : 'páginas listas'}
                    </span>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={clearAllPages}
                      className="min-h-[34px] rounded-lg px-2.5 font-medium text-red-600 dark:text-red-300 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                    >
                      Limpiar todas
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {uploadProgress && (
            <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3.5">
              <div className="flex items-center justify-between text-xs font-medium text-[var(--accent-primary)]">
                <span>Subiendo páginas al bucket media…</span>
                <span className="tabular-nums">
                  {uploadProgress.current} / {uploadProgress.total}
                </span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div
              ref={errorBoxRef}
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-500/50 bg-red-500/15 px-4 py-3.5 text-sm font-medium text-red-700 dark:text-red-100"
            >
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0 text-red-500 dark:text-red-400"
                aria-hidden="true"
              />
              <span className="break-words">{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[46px] rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                  <span>
                    {uploadProgress
                      ? `Subiendo (${uploadProgress.current}/${uploadProgress.total})…`
                      : 'Publicando…'}
                  </span>
                </>
              ) : (
                <>
                  <Upload size={16} aria-hidden="true" />
                  <span>Publicar capítulo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
