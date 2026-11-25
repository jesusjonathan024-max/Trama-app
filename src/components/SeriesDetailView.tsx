import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownUp,
  ArrowLeft,
  BookMarked,
  BookOpen,
  ChevronRight,
  Heart,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocial } from '../context/SocialContext';
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
import {
  READING_STATUS_OPTIONS,
  type ReadingStatus,
} from '../lib/social';
import {
  fetchSingleSeriesRating,
  upsertSeriesRating,
  type SeriesRatingSummary,
} from '../lib/phase2';
import { Avatar } from './Avatar';
import { CategoryCoverArtwork } from './CategoryCoverArtwork';
import { CreateChapterModal } from './CreateChapterModal';
import { FollowButton } from './FollowButton';
import { MediaImage } from './MediaImage';
import { OwnerBadge } from './OwnerBadge';
import { StarRating } from './StarRating';

interface SeriesDetailViewProps {
  initialSeries: SeriesRecord;
  onBack: () => void;
  onOpenAuth: () => void;
  onOpenAuthorProfile: (authorId: string) => void;
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
  onOpenAuth,
  onOpenAuthorProfile,
  onOpenChapter,
  onSeriesDeleted,
  onSeriesChanged,
}: SeriesDetailViewProps) {
  const { user, isAuthenticated, isOwner } = useAuth();
  const {
    getSeriesCollection,
    setSeriesStatus,
    toggleSeriesFavorite,
    busySeriesIds,
  } = useSocial();
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
  const [ratingSummary, setRatingSummary] = useState<SeriesRatingSummary>({
    average: 0,
    count: 0,
    userRating: null,
  });
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoadingChapters(true);
    setErrorMsg(null);
    try {
      const [freshSeries, chapterList, ratingData] = await Promise.all([
        fetchSeriesById(initialSeries.id),
        fetchChaptersBySeries(initialSeries.id),
        fetchSingleSeriesRating(initialSeries.id, user?.id).catch(() => ({
          average: 0,
          count: 0,
          userRating: null,
        })),
      ]);
      if (freshSeries) {
        setSeries(freshSeries);
      }
      setChapters(chapterList);
      setRatingSummary(ratingData);
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
  }, [initialSeries.id, user?.id]);

  useEffect(() => {
    setSeries(initialSeries);
    setProgress(getReadingProgress(initialSeries.id));
    void loadData();
  }, [initialSeries, loadData]);

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
  const canModerate = Boolean(isOwner || isCreator);
  const isManhwa = isManhwaType(series.type);
  const authorName = getAuthorDisplayName(series.author);
  const collectionEntry = getSeriesCollection(series.id);
  const isFavorite = Boolean(collectionEntry?.is_favorite);
  const currentReadingStatus = collectionEntry?.status ?? '';
  const isUpdatingCollection = Boolean(busySeriesIds[series.id]);

  async function handleReadingStatusChange(raw: string) {
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }
    const nextStatus = raw ? (raw as ReadingStatus) : null;
    await setSeriesStatus(series.id, nextStatus);
  }

  async function handleToggleFavorite() {
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }
    await toggleSeriesFavorite(series.id);
  }

  async function handleRateSeries(stars: number) {
    if (!user) {
      onOpenAuth();
      return;
    }
    if (isSubmittingRating) return;
    setIsSubmittingRating(true);
    setErrorMsg(null);
    try {
      await upsertSeriesRating(series.id, user.id, stars);
      const refreshed = await fetchSingleSeriesRating(series.id, user.id);
      setRatingSummary(refreshed);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar tu calificación.'
      );
    } finally {
      setIsSubmittingRating(false);
    }
  }

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
    if (!user || !canModerate) return;
    setIsDeletingSeries(true);
    setErrorMsg(null);
    try {
      await deleteSeries(series.id, user.id, isOwner);
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
    if (!user || !canModerate) return;
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
    <section className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:px-6 md:px-8 md:py-10 md:pb-20">
      {/* Navegación superior */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] -ml-2 inline-flex items-center gap-2 rounded-xl px-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Volver a Biblioteca</span>
        </button>

        {canModerate && !confirmingDeleteSeries && (
          <button
            type="button"
            onClick={() => setConfirmingDeleteSeries(true)}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:border-red-500/35 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          >
            <Trash2 size={14} aria-hidden="true" />
            <span>Eliminar obra</span>
          </button>
        )}

        {canModerate && confirmingDeleteSeries && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--text-secondary)]">
              ¿Eliminar esta obra?
            </span>
            <button
              type="button"
              disabled={isDeletingSeries}
              onClick={() => void handleConfirmDeleteSeries()}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
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
              className="min-h-[38px] rounded-lg px-2.5 text-[var(--text-secondary)] hover:text-[var(--text-main)]"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Ficha principal de la obra */}
      <div className="grid grid-cols-1 gap-6 border-b border-[var(--border-subtle)] pb-8 md:grid-cols-12 md:gap-8 transition-colors duration-300">
        {/* Portada grande */}
        <div className="mx-auto w-52 sm:w-60 md:col-span-4 md:mx-0 md:w-full">
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
            {series.cover_url ? (
              <MediaImage
                src={series.cover_url}
                alt={`Portada de ${series.title}`}
                className="h-full w-full object-cover"
                fallbackClassName="h-full w-full"
              />
            ) : (
              <CategoryCoverArtwork
                category={series.genre || (isManhwa ? 'Manhwa' : 'Novela')}
                title={series.title}
                fallbackMode={isManhwa ? 'manhwa' : 'novela'}
                variant="portrait"
                className="h-full w-full"
              />
            )}

            <span
              className={`absolute left-3 top-3 rounded-lg px-2.5 py-1 text-xs font-bold text-white shadow-sm backdrop-blur-sm ${
                isManhwa
                  ? 'bg-gradient-to-r from-violet-600/95 to-fuchsia-600/95'
                  : 'bg-gradient-to-r from-indigo-600/95 to-violet-600/95'
              }`}
            >
              {isManhwa ? 'Manhwa' : 'Novela'}
            </span>
          </div>
        </div>

        {/* Metadatos, sinopsis y botones de acción */}
        <div className="flex flex-col justify-between md:col-span-8">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--accent-primary)]">
                {series.genre}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[var(--text-main)]">{series.status}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {ascendingChapters.length}{' '}
                {ascendingChapters.length === 1 ? 'capítulo' : 'capítulos'}
              </span>
            </div>

            <h1 className="mt-2.5 text-balance font-display text-3xl font-bold leading-tight tracking-tight text-[var(--text-main)] sm:text-4xl">
              {series.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onOpenAuthorProfile(series.author_id)}
                className="inline-flex items-center gap-2 rounded-lg text-left hover:text-[var(--accent-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              >
                <Avatar
                  src={series.author?.avatar_url}
                  name={series.author?.username}
                  size="sm"
                />
                <span className="text-sm font-medium text-[var(--text-main)]">
                  {authorName}
                </span>
              </button>
              <OwnerBadge
                role={series.author?.role}
                badge={series.author?.badge}
                size="sm"
              />
              <FollowButton
                targetUserId={series.author_id}
                onOpenAuth={onOpenAuth}
                size="sm"
              />
            </div>

            <div className="mt-5">
              <h2 className="text-xs font-semibold text-[var(--text-muted)]">
                Sinopsis
              </h2>
              <p className="mt-2 reading-prose-compact text-[var(--text-secondary)] whitespace-pre-line break-words">
                {series.synopsis || 'Esta obra aún no tiene sinopsis.'}
              </p>
            </div>

            {/* Calificación con estrellas (1 a 5) */}
            <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3 transition-colors duration-300">
              <p className="text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                Calificación de lectores
              </p>
              <StarRating
                average={ratingSummary.average}
                count={ratingSummary.count}
                userRating={ratingSummary.userRating}
                interactive
                isSubmitting={isSubmittingRating}
                onRate={(val) => void handleRateSeries(val)}
              />
            </div>
          </div>

          {/* Controles de lectura, lista personal y favorita */}
          <div className="mt-7 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {ascendingChapters.length > 0 && (
                <button
                  type="button"
                  onClick={handleStartOrContinue}
                  className="min-h-[48px] flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 py-3 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
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
                  className="min-h-[48px] flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-3 text-sm font-semibold text-[var(--text-main)] hover:bg-[var(--bg-elevated)] active:scale-[0.98] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                >
                  <Plus size={17} aria-hidden="true" />
                  <span>Subir Capítulo</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <div className="relative flex-1 sm:flex-none sm:min-w-[210px]">
                <BookMarked
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--accent-primary)]"
                  aria-hidden="true"
                />
                <label htmlFor="detail-reading-status" className="sr-only">
                  Estado de lectura
                </label>
                <select
                  id="detail-reading-status"
                  value={currentReadingStatus}
                  disabled={isUpdatingCollection}
                  onChange={(e) => void handleReadingStatusChange(e.target.value)}
                  className={`min-h-[44px] w-full rounded-xl border pl-9 pr-3 text-xs font-semibold transition-colors duration-300 focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25 ${
                    currentReadingStatus
                      ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-main)]'
                  }`}
                >
                  <option value="">Sin estado de lectura</option>
                  {READING_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => void handleToggleFavorite()}
                disabled={isUpdatingCollection}
                aria-pressed={isFavorite}
                className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border px-4 text-xs font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  isFavorite
                    ? 'border-rose-500/40 bg-rose-500/12 text-rose-600 dark:text-rose-200'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                }`}
              >
                <Heart
                  size={15}
                  className={isFavorite ? 'fill-current' : ''}
                  aria-hidden="true"
                />
                <span>{isFavorite ? 'Favorita' : 'Marcar favorita'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mt-6 flex items-center gap-2.5 rounded-xl border border-red-500/35 bg-red-500/12 px-4 py-3 text-sm text-red-700 dark:text-red-200"
        >
          <AlertCircle
            size={17}
            className="shrink-0 text-red-500 dark:text-red-400"
            aria-hidden="true"
          />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Lista de capítulos */}
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <h2 className="font-display text-xl font-bold tracking-tight text-[var(--text-main)]">
            Capítulos{' '}
            <span className="text-base font-medium tabular-nums text-[var(--text-muted)]">
              ({ascendingChapters.length})
            </span>
          </h2>

          {ascendingChapters.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
              }
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
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
                className="h-16 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]"
              />
            ))}
          </div>
        ) : displayedChapters.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-12 text-center transition-colors duration-300">
            <BookOpen
              size={24}
              className="text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-medium text-[var(--text-main)]">
              Todavía no hay capítulos publicados
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {isCreator
                ? 'Sube el primer capítulo para que los lectores puedan empezar esta historia.'
                : 'Vuelve pronto para leer el estreno del primer capítulo.'}
            </p>
            {isCreator && (
              <button
                type="button"
                onClick={() => setIsChapterModalOpen(true)}
                className="mt-5 min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] transition-colors"
              >
                <Plus size={16} aria-hidden="true" />
                <span>Subir Capítulo 1</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden transition-colors duration-300">
            {displayedChapters.map((chapter) => {
              const isLastRead = progress?.chapterId === chapter.id;
              const isConfirming = confirmDeleteChapterId === chapter.id;
              const isDeleting = deletingChapterId === chapter.id;

              return (
                <div
                  key={chapter.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3.5 hover:bg-[var(--bg-elevated)]/65 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => handleOpenSpecificChapter(chapter.id)}
                    className="min-h-[44px] flex min-w-0 flex-1 items-center justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold tabular-nums text-[var(--text-main)]">
                          Capítulo {formatChapterNumber(chapter.chapter_number)}
                        </span>
                        {chapter.title && (
                          <>
                            <span
                              aria-hidden="true"
                              className="text-[var(--text-muted)]"
                            >
                              ·
                            </span>
                            <span className="truncate text-sm text-[var(--text-secondary)]">
                              {chapter.title}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[var(--text-muted)]">
                        <time
                          dateTime={chapter.created_at}
                          className="tabular-nums"
                        >
                          {formatEditorialDate(chapter.created_at)}
                        </time>
                        {isManhwa && chapter.image_urls.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
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
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[var(--accent-primary)]">
                              Último leído
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <ChevronRight
                      size={18}
                      className="shrink-0 text-[var(--text-muted)]"
                      aria-hidden="true"
                    />
                  </button>

                  {canModerate && !isConfirming && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteChapterId(chapter.id)}
                      aria-label={`Eliminar capítulo ${chapter.chapter_number}`}
                      className="min-h-[40px] min-w-[40px] self-end sm:self-center inline-flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-red-500/12 hover:text-red-600 dark:hover:text-red-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}

                  {canModerate && isConfirming && (
                    <div className="flex items-center justify-end gap-2 text-xs">
                      <span className="text-[var(--text-secondary)]">
                        ¿Eliminar?
                      </span>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() =>
                          void handleConfirmDeleteChapter(chapter.id)
                        }
                        className="min-h-[34px] rounded-lg bg-red-600 px-2.5 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        {isDeleting ? 'Borrando…' : 'Confirmar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteChapterId(null)}
                        className="min-h-[34px] rounded-lg px-2 text-[var(--text-secondary)] hover:text-[var(--text-main)]"
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
