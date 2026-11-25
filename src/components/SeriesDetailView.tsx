import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownUp,
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  deleteChapter,
  deleteSeries,
  fetchChaptersBySeries,
  fetchSeriesById,
  formatChapterNumber,
  getReadingProgress,
  isManhwaType,
  type ChapterRecord,
  type ReadingProgressEntry,
  type SeriesRecord,
} from '../lib/library';
import { formatEditorialDate, getAuthorDisplayName } from '../lib/posts';
import { Avatar } from './Avatar';
import { CreateChapterModal } from './CreateChapterModal';
import { MediaImage } from './MediaImage';

interface SeriesDetailViewProps {
  initialSeries: SeriesRecord;
  onBack: () => void;
  onOpenChapter: (
    series: SeriesRecord,
    chaptersAscending: ChapterRecord[],
    chapterIndex: number
  ) => void;
  onSeriesDeleted: (seriesId: string) => void;
  onSeriesChanged: () => void;
}

export function SeriesDetailView({
  initialSeries,
  onBack,
  onOpenChapter,
  onSeriesDeleted,
  onSeriesChanged,
}: SeriesDetailViewProps) {
  const { user } = useAuth();
  const [series, setSeries] = useState<SeriesRecord>(initialSeries);
  const [chapters, setChapters] = useState<ChapterRecord[]>([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);

  const [confirmingDeleteSeries, setConfirmingDeleteSeries] = useState(false);
  const [isDeletingSeries, setIsDeletingSeries] = useState(false);
  const [confirmDeleteChapterId, setConfirmDeleteChapterId] = useState<
    string | null
  >(null);
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(
    null
  );

  const [progress, setProgress] = useState<ReadingProgressEntry | null>(() =>
    getReadingProgress(initialSeries.id)
  );

  const loadData = useCallback(async () => {
    setIsLoadingChapters(true);
    setErrorMsg(null);
    try {
      const [freshSeries, chapterList] = await Promise.all([
        fetchSeriesById(initialSeries.id),
        fetchChaptersBySeries(initialSeries.id),
      ]);
      if (freshSeries) {
        setSeries(freshSeries);
      }
      setChapters(chapterList);
      setProgress(getReadingProgress(initialSeries.id));
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los capítulos de esta obra.'
      );
    } finally {
      setIsLoadingChapters(false);
    }
  }, [initialSeries.id]);

  useEffect(() => {
    setSeries(initialSeries);
    setProgress(getReadingProgress(initialSeries.id));
    void loadData();
  }, [initialSeries, loadData]);

  // Orden ascendente canónico (usado para navegación anterior/siguiente)
  const ascendingChapters = useMemo(
    () =>
      [...chapters].sort((a, b) => a.chapter_number - b.chapter_number),
    [chapters]
  );

  const displayedChapters = useMemo(
    () =>
      sortOrder === 'asc'
        ? ascendingChapters
        : [...ascendingChapters].reverse(),
    [ascendingChapters, sortOrder]
  );

  const suggestedChapterNumber = useMemo(() => {
    if (ascendingChapters.length === 0) return 1;
    const highest =
      ascendingChapters[ascendingChapters.length - 1].chapter_number;
    return Math.floor(highest) + 1;
  }, [ascendingChapters]);

  const continueChapterIndex = useMemo(() => {
    if (!progress || ascendingChapters.length === 0) return -1;
    return ascendingChapters.findIndex((ch) => ch.id === progress.chapterId);
  }, [progress, ascendingChapters]);

  const isCreator = Boolean(user && user.id === series.author_id);
  const isManhwa = isManhwaType(series.type);
  const authorName = getAuthorDisplayName(series.author);

  function handleStartOrContinue() {
    if (ascendingChapters.length === 0) return;
    const targetIdx = continueChapterIndex >= 0 ? continueChapterIndex : 0;
    onOpenChapter(series, ascendingChapters, targetIdx);
  }

  function handleOpenSpecificChapter(chapterId: string) {
    const idx = ascendingChapters.findIndex((ch) => ch.id === chapterId);
    if (idx >= 0) {
      onOpenChapter(series, ascendingChapters, idx);
    }
  }

  async function handleConfirmDeleteSeries() {
    if (!user || !isCreator) return;
    setIsDeletingSeries(true);
    setErrorMsg(null);
    try {
      await deleteSeries(series.id, user.id);
      onSeriesDeleted(series.id);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo eliminar la obra.'
      );
      setIsDeletingSeries(false);
      setConfirmingDeleteSeries(false);
    }
  }

  async function handleConfirmDeleteChapter(chapterId: string) {
    if (!user || !isCreator) return;
    setDeletingChapterId(chapterId);
    setErrorMsg(null);
    try {
      await deleteChapter(chapterId);
      setChapters((prev) => prev.filter((item) => item.id !== chapterId));
      setConfirmDeleteChapterId(null);
      onSeriesChanged();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el capítulo.'
      );
    } finally {
      setDeletingChapterId(null);
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:px-6 md:px-8 md:py-10 md:pb-20">
      {/* Navegación superior */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] -ml-2 inline-flex items-center gap-2 rounded-xl px-2.5 text-sm font-medium text-[#9AA4B6] hover:bg-white/[0.05] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Volver a Biblioteca</span>
        </button>

        {isCreator && !confirmingDeleteSeries && (
          <button
            type="button"
            onClick={() => setConfirmingDeleteSeries(true)}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-white/[0.09] px-3 text-xs font-medium text-[#9AA4B6] hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
          >
            <Trash2 size={14} aria-hidden="true" />
            <span>Eliminar obra</span>
          </button>
        )}

        {isCreator && confirmingDeleteSeries && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#9AA4B6]">¿Eliminar esta obra?</span>
            <button
              type="button"
              disabled={isDeletingSeries}
              onClick={() => void handleConfirmDeleteSeries()}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 font-medium text-red-200 hover:bg-red-500/30 disabled:opacity-50"
            >
              {isDeletingSeries && (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              )}
              <span>Confirmar</span>
            </button>
            <button
              type="button"
              disabled={isDeletingSeries}
              onClick={() => setConfirmingDeleteSeries(false)}
              className="min-h-[38px] rounded-lg px-2.5 text-[#9AA4B6] hover:text-white"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Ficha principal de la obra */}
      <div className="grid grid-cols-1 gap-6 border-b border-white/[0.08] pb-8 md:grid-cols-12 md:gap-8">
        {/* Portada grande */}
        <div className="mx-auto w-52 sm:w-60 md:col-span-4 md:mx-0 md:w-full">
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#131720]">
            {series.cover_url ? (
              <MediaImage
                src={series.cover_url}
                alt={`Portada de ${series.title}`}
                className="h-full w-full object-cover"
                fallbackClassName="h-full w-full"
              />
            ) : (
              <div
                className={`flex h-full w-full flex-col items-center justify-center ${
                  isManhwa
                    ? 'bg-gradient-to-br from-[#2B2012] via-[#171412] to-[#0E1118]'
                    : 'bg-gradient-to-br from-[#13233C] via-[#111622] to-[#0C0F16]'
                }`}
              >
                <BookOpen size={40} className="text-white/25" aria-hidden="true" />
              </div>
            )}

            <span
              className={`absolute left-3 top-3 rounded-lg px-2.5 py-1 text-xs font-semibold backdrop-blur-sm ${
                isManhwa
                  ? 'bg-[#B45309]/90 text-[#FEF3C7]'
                  : 'bg-[#1D4ED8]/90 text-[#DBEAFE]'
              }`}
            >
              {isManhwa ? 'Manhwa' : 'Novela'}
            </span>
          </div>
        </div>

        {/* Metadatos, sinopsis y botones de acción */}
        <div className="flex flex-col justify-between md:col-span-8">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#97A1B2]">
              <span className={isManhwa ? 'text-[#FCD38D]' : 'text-[#8EC0FF]'}>
                {series.genre}
              </span>
              <span aria-hidden="true" className="text-[#566072]">
                ·
              </span>
              <span className="text-[#E2E8F0]">{series.status}</span>
              <span aria-hidden="true" className="text-[#566072]">
                ·
              </span>
              <span className="tabular-nums">
                {ascendingChapters.length}{' '}
                {ascendingChapters.length === 1 ? 'capítulo' : 'capítulos'}
              </span>
            </div>

            <h1 className="mt-2.5 text-balance font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
              {series.title}
            </h1>

            <div className="mt-4 flex items-center gap-2.5">
              <Avatar
                src={series.author?.avatar_url}
                name={series.author?.username}
                size="sm"
              />
              <span className="text-sm font-medium text-[#D5DCE6]">
                {authorName}
              </span>
            </div>

            <div className="mt-5">
              <h2 className="text-xs font-semibold text-[#8B95A5]">
                Sinopsis
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#CED6E3] whitespace-pre-line break-words sm:text-[15px]">
                {series.synopsis || 'Esta obra aún no tiene sinopsis.'}
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {ascendingChapters.length > 0 && (
              <button
                type="button"
                onClick={handleStartOrContinue}
                className="min-h-[48px] flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-[#388BFF] px-5 py-3 text-sm font-semibold text-[#06101F] hover:bg-[#529BFF] active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
              >
                <BookOpen size={17} aria-hidden="true" />
                <span>
                  {continueChapterIndex >= 0
                    ? `Continuar Cap. ${formatChapterNumber(
                        ascendingChapters[continueChapterIndex].chapter_number
                      )}`
                    : `Empezar Cap. ${formatChapterNumber(
                        ascendingChapters[0].chapter_number
                      )}`}
                </span>
              </button>
            )}

            {isCreator && (
              <button
                type="button"
                onClick={() => setIsChapterModalOpen(true)}
                className="min-h-[48px] flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.14] bg-[#151A24] px-5 py-3 text-sm font-semibold text-white hover:border-white/[0.25] hover:bg-[#1B2230] active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
              >
                <Plus size={17} aria-hidden="true" />
                <span>Subir Capítulo</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mt-6 flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          <AlertCircle size={17} className="shrink-0 text-red-400" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Lista de capítulos */}
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <h2 className="font-display text-xl font-bold tracking-tight text-white">
            Capítulos{' '}
            <span className="text-base font-medium tabular-nums text-[#8B95A5]">
              ({ascendingChapters.length})
            </span>
          </h2>

          {ascendingChapters.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
              }
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-white/[0.09] bg-[#11151D] px-3.5 text-xs font-medium text-[#CBD5E1] hover:border-white/[0.18] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
            >
              <ArrowDownUp size={14} aria-hidden="true" />
              <span>
                {sortOrder === 'desc'
                  ? 'Más recientes primero'
                  : 'Desde el Cap. 1'}
              </span>
            </button>
          )}
        </div>

        {isLoadingChapters ? (
          <div className="space-y-2.5 animate-pulse">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="h-16 w-full rounded-xl border border-white/[0.06] bg-[#11151D]"
              />
            ))}
          </div>
        ) : displayedChapters.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-[#10141C] px-6 py-12 text-center">
            <BookOpen size={24} className="text-[#6E788B]" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-[#DCE2EC]">
              Todavía no hay capítulos publicados
            </p>
            <p className="mt-1 text-xs text-[#838D9F]">
              {isCreator
                ? 'Sube el primer capítulo para que los lectores puedan empezar esta historia.'
                : 'Vuelve pronto para leer el estreno del primer capítulo.'}
            </p>
            {isCreator && (
              <button
                type="button"
                onClick={() => setIsChapterModalOpen(true)}
                className="mt-5 min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#388BFF] px-4 py-2 text-sm font-semibold text-[#06101F] hover:bg-[#529BFF] transition-colors"
              >
                <Plus size={16} aria-hidden="true" />
                <span>Subir Capítulo 1</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.07] rounded-2xl border border-white/[0.08] bg-[#11151D] overflow-hidden">
            {displayedChapters.map((chapter) => {
              const isLastRead = progress?.chapterId === chapter.id;
              const isConfirming = confirmDeleteChapterId === chapter.id;
              const isDeleting = deletingChapterId === chapter.id;

              return (
                <div
                  key={chapter.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3.5 hover:bg-white/[0.025] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => handleOpenSpecificChapter(chapter.id)}
                    className="min-h-[44px] flex min-w-0 flex-1 items-center justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold tabular-nums text-white">
                          Capítulo {formatChapterNumber(chapter.chapter_number)}
                        </span>
                        {chapter.title && (
                          <>
                            <span aria-hidden="true" className="text-[#566072]">
                              ·
                            </span>
                            <span className="truncate text-sm text-[#C7D0DF]">
                              {chapter.title}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[#838D9F]">
                        <time
                          dateTime={chapter.created_at}
                          className="tabular-nums"
                        >
                          {formatEditorialDate(chapter.created_at)}
                        </time>
                        {isManhwa && chapter.image_urls.length > 0 && (
                          <>
                            <span aria-hidden="true" className="text-[#566072]">
                              ·
                            </span>
                            <span className="tabular-nums">
                              {chapter.image_urls.length}{' '}
                              {chapter.image_urls.length === 1
                                ? 'página'
                                : 'páginas'}
                            </span>
                          </>
                        )}
                        {isLastRead && (
                          <>
                            <span aria-hidden="true" className="text-[#566072]">
                              ·
                            </span>
                            <span className="font-medium text-[#7FB2FF]">
                              Último leído
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <ChevronRight
                      size={18}
                      className="shrink-0 text-[#667085]"
                      aria-hidden="true"
                    />
                  </button>

                  {isCreator && !isConfirming && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteChapterId(chapter.id)}
                      aria-label={`Eliminar capítulo ${chapter.chapter_number}`}
                      className="min-h-[40px] min-w-[40px] self-end sm:self-center inline-flex items-center justify-center rounded-lg text-[#7E889B] hover:bg-red-500/10 hover:text-red-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}

                  {isCreator && isConfirming && (
                    <div className="flex items-center justify-end gap-2 text-xs">
                      <span className="text-[#9AA4B6]">¿Eliminar?</span>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() =>
                          void handleConfirmDeleteChapter(chapter.id)
                        }
                        className="min-h-[34px] rounded-lg bg-red-500/20 px-2.5 font-medium text-red-200 hover:bg-red-500/30 disabled:opacity-50"
                      >
                        {isDeleting ? 'Borrando…' : 'Confirmar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteChapterId(null)}
                        className="min-h-[34px] rounded-lg px-2 text-[#9AA4B6] hover:text-white"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateChapterModal
        isOpen={isChapterModalOpen}
        series={series}
        suggestedChapterNumber={suggestedChapterNumber}
        onClose={() => setIsChapterModalOpen(false)}
        onCreated={(created) => {
          setChapters((prev) => [...prev, created]);
          onSeriesChanged();
        }}
      />
    </section>
  );
}
