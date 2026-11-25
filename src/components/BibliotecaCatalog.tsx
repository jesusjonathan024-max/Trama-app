import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Heart,
  Plus,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocial } from '../context/SocialContext';
import {
  fetchSeriesCatalog,
  type SeriesRecord,
  type SeriesType,
} from '../lib/library';
import { getAuthorDisplayName } from '../lib/posts';
import {
  READING_STATUS_OPTIONS,
  type ReadingStatus,
} from '../lib/social';
import {
  fetchRatingsSummaryMap,
  type SeriesRatingSummary,
} from '../lib/phase2';
import { getCategoryVisualTheme } from '../lib/categoryColors';
import { Avatar } from './Avatar';
import { CategoryCoverArtwork } from './CategoryCoverArtwork';
import { FollowButton } from './FollowButton';
import { MediaImage } from './MediaImage';
import { OwnerBadge } from './OwnerBadge';
import { StarRating } from './StarRating';

export type BibliotecaFilter = 'todas' | SeriesType | 'siguiendo';

interface BibliotecaCatalogProps {
  selectedFilter: BibliotecaFilter;
  onSelectFilter: (filter: BibliotecaFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  refreshKey: number;
  deletedSeriesId: string | null;
  onSelectSeries: (series: SeriesRecord) => void;
  onOpenAuthorProfile: (authorId: string) => void;
  onOpenCreateSeries: () => void;
  onOpenAuth: () => void;
}

const FILTER_TABS: { id: BibliotecaFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'novela', label: 'Novelas' },
  { id: 'manhwa', label: 'Manhwas' },
  { id: 'siguiendo', label: 'Siguiendo' },
];

export function BibliotecaCatalog({
  selectedFilter,
  onSelectFilter,
  searchQuery,
  onSearchQueryChange,
  refreshKey,
  deletedSeriesId,
  onSelectSeries,
  onOpenAuthorProfile,
  onOpenCreateSeries,
  onOpenAuth,
}: BibliotecaCatalogProps) {
  const { user, isAuthenticated } = useAuth();
  const {
    followingIds,
    getSeriesCollection,
    setSeriesStatus,
    toggleSeriesFavorite,
    busySeriesIds,
  } = useSocial();
  const [seriesList, setSeriesList] = useState<SeriesRecord[]>([]);
  const [ratingsMap, setRatingsMap] = useState<
    Record<string, SeriesRatingSummary>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchSeriesCatalog();
      setSeriesList(data);
      if (data.length > 0) {
        fetchRatingsSummaryMap(
          data.map((s) => s.id),
          user?.id
        )
          .then(setRatingsMap)
          .catch(() => {
            // Mantiene el catálogo funcional aunque falle la consulta auxiliar
          });
      } else {
        setRatingsMap({});
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el catálogo de Biblioteca.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog, refreshKey]);

  useEffect(() => {
    if (!deletedSeriesId) return;
    setSeriesList((prev) => prev.filter((item) => item.id !== deletedSeriesId));
  }, [deletedSeriesId]);

  const filteredSeries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return seriesList.filter((item) => {
      if (selectedFilter === 'siguiendo') {
        if (!followingIds.has(item.author_id)) return false;
      } else if (selectedFilter !== 'todas' && item.type !== selectedFilter) {
        return false;
      }
      if (normalizedQuery) {
        return item.title.toLowerCase().includes(normalizedQuery);
      }
      return true;
    });
  }, [seriesList, selectedFilter, searchQuery, followingIds]);

  async function handleCardFavorite(seriesId: string) {
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }
    await toggleSeriesFavorite(seriesId);
  }

  async function handleCardStatusChange(seriesId: string, raw: string) {
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }
    const nextStatus = raw ? (raw as ReadingStatus) : null;
    await setSeriesStatus(seriesId, nextStatus);
  }

  return (
    <section
      aria-labelledby="biblioteca-heading"
      className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 md:px-8 md:py-10 md:pb-20"
    >
      {/* Cabecera de Biblioteca + botón "+ Nueva Obra" */}
      <div className="border-b border-[var(--border-subtle)] pb-5 transition-colors duration-300">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              id="biblioteca-heading"
              className="font-display text-3xl font-bold tracking-tight text-[var(--text-main)] sm:text-4xl"
            >
              Biblioteca
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Catálogo de novelas web y manhwas por capítulos.
            </p>
          </div>

          {isAuthenticated && (
            <button
              type="button"
              onClick={onOpenCreateSeries}
              className="trama-btn-primary min-h-[44px] self-start sm:self-auto inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            >
              <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
              <span>Nueva Obra</span>
            </button>
          )}
        </div>

        {/* Filtros de tipo + buscador por título */}
        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div
            role="tablist"
            aria-label="Filtrar obras por tipo"
            className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0"
          >
            {FILTER_TABS.map((tab) => {
              const isActive = selectedFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSelectFilter(tab.id)}
                  className={`min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors duration-300 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                    isActive
                      ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)] font-semibold'
                      : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {tab.id === 'siguiendo' && (
                    <UserCheck size={14} aria-hidden="true" />
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:max-w-xs">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <label htmlFor="biblioteca-search" className="sr-only">
              Buscar obra por título
            </label>
            <input
              id="biblioteca-search"
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Buscar por título…"
              className="min-h-[44px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] pl-10 pr-10 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25 transition-colors duration-300"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchQueryChange('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Estados del catálogo */}
      {isLoading ? (
        <div className="mt-7 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
            <div
              key={item}
              className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]"
            >
              <div className="aspect-[3/4] w-full bg-[var(--bg-elevated)]" />
              <div className="p-3.5 space-y-2.5">
                <div className="h-4 w-4/5 rounded bg-[var(--bg-elevated)]" />
                <div className="h-3 w-1/2 rounded bg-[var(--bg-subtle)]" />
              </div>
            </div>
          ))}
        </div>
      ) : errorMsg ? (
        <div
          role="alert"
          className="mt-8 flex flex-col gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-700 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle
              size={18}
              className="shrink-0 text-red-500 dark:text-red-400"
              aria-hidden="true"
            />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadCatalog()}
            className="min-h-[40px] self-start sm:self-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : filteredSeries.length === 0 ? (
        <div className="mx-auto mt-14 flex max-w-md flex-col items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-14 text-center transition-colors duration-300">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <BookOpen size={22} aria-hidden="true" />
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold text-[var(--text-main)]">
            {searchQuery.trim()
              ? 'No encontramos obras con ese título'
              : selectedFilter === 'siguiendo'
                ? !isAuthenticated
                  ? 'Inicia sesión para ver autores seguidos'
                  : 'Aún no hay obras de autores que sigues'
                : selectedFilter === 'todas'
                  ? 'La Biblioteca aún está vacía'
                  : selectedFilter === 'novela'
                    ? 'Todavía no hay novelas registradas'
                    : 'Todavía no hay manhwas registrados'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            {searchQuery.trim()
              ? 'Prueba con otra palabra o limpia el buscador para ver todo el catálogo.'
              : selectedFilter === 'siguiendo'
                ? 'Sigue a tus autores favoritos desde cualquier obra o perfil para encontrar sus títulos aquí.'
                : 'Sé la primera persona en registrar una obra y subir sus primeros capítulos.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {(searchQuery.trim() || selectedFilter !== 'todas') && (
              <button
                type="button"
                onClick={() => {
                  onSearchQueryChange('');
                  onSelectFilter('todas');
                }}
                className="min-h-[44px] rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                Ver todo el catálogo
              </button>
            )}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onOpenCreateSeries}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] transition-colors"
              >
                <Plus size={16} aria-hidden="true" />
                <span>Nueva Obra</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="min-h-[44px] rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] transition-colors"
              >
                Iniciar sesión para publicar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {filteredSeries.map((series) => {
            const isManhwa = series.type === 'manhwa';
            const collection = getSeriesCollection(series.id);
            const isFav = Boolean(collection?.is_favorite);
            const readingStatus = collection?.status ?? '';
            const isBusy = Boolean(busySeriesIds[series.id]);

            const genreTheme = getCategoryVisualTheme(
              series.genre,
              isManhwa ? 'manhwa' : 'novela'
            );

            return (
              <article
                key={series.id}
                className="trama-card-glow group flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-left shadow-sm"
              >
                {/* Portada vertical 3:4 */}
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--bg-subtle)]">
                  <button
                    type="button"
                    onClick={() => onSelectSeries(series)}
                    aria-label={`Abrir ${series.title}`}
                    className="block h-full w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary)]"
                  >
                    {series.cover_url ? (
                      <MediaImage
                        src={series.cover_url}
                        alt={`Portada de ${series.title}`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        fallbackClassName="h-full w-full"
                      />
                    ) : (
                      <CategoryCoverArtwork
                        category={series.genre || (isManhwa ? 'Manhwa' : 'Novela')}
                        title={series.title}
                        fallbackMode={isManhwa ? 'manhwa' : 'novela'}
                        variant="portrait"
                        className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    )}
                  </button>

                  {/* Scrim inferior medido para alto contraste */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent"
                  />

                  <span
                    className={`pointer-events-none absolute left-2.5 top-2.5 rounded-lg px-2 py-0.5 text-[11px] font-bold tracking-wide text-white shadow-sm backdrop-blur-sm ${
                      isManhwa
                        ? 'bg-gradient-to-r from-violet-600/95 to-fuchsia-600/95'
                        : 'bg-gradient-to-r from-indigo-600/95 to-violet-600/95'
                    }`}
                  >
                    {isManhwa ? 'Manhwa' : 'Novela'}
                  </span>

                  {/* Botón rápido de Favorita */}
                  <button
                    type="button"
                    onClick={() => void handleCardFavorite(series.id)}
                    disabled={isBusy}
                    aria-pressed={isFav}
                    aria-label={
                      isFav
                        ? `Quitar ${series.title} de favoritas`
                        : `Marcar ${series.title} como favorita`
                    }
                    title={isFav ? 'En favoritos' : 'Marcar como favorita'}
                    className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-xl backdrop-blur-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                      isFav
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'bg-black/55 text-white/90 hover:bg-black/75'
                    }`}
                  >
                    <Heart
                      size={14}
                      className={isFav ? 'fill-current' : ''}
                      aria-hidden="true"
                    />
                  </button>

                  <div className="pointer-events-none absolute inset-x-2.5 bottom-2 flex items-center justify-between gap-2 text-[11px] font-medium text-white/95">
                    <span className="truncate">{series.status}</span>
                    {series.chapters_count > 0 && (
                      <span className="shrink-0 tabular-nums text-white/80">
                        {series.chapters_count}{' '}
                        {series.chapters_count === 1 ? 'cap.' : 'caps.'}
                      </span>
                    )}
                  </div>
                </div>

                {/* ZONA 1 + 2: Cabecera de género, título y selector rápido de estado */}
                <div className="flex flex-1 flex-col justify-between p-3 sm:p-3.5">
                  <div>
                    <div className="flex items-center justify-between gap-1.5 text-[11px] font-bold">
                      <span className={`truncate ${genreTheme.textClass}`}>
                        {series.genre}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectSeries(series)}
                      className="mt-1 block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded"
                    >
                      <h2 className="line-clamp-2 font-display text-[15px] font-bold leading-snug text-[var(--text-main)] group-hover:text-[var(--accent-primary)] transition-colors duration-300 sm:text-base">
                        {series.title}
                      </h2>
                    </button>

                    <div className="mt-1.5">
                      <StarRating
                        average={ratingsMap[series.id]?.average ?? 0}
                        count={ratingsMap[series.id]?.count ?? 0}
                        compact
                      />
                    </div>

                    {series.synopsis && (
                      <p className="mt-1.5 hidden sm:line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                        {series.synopsis}
                      </p>
                    )}

                    {/* Selector de estado de lectura */}
                    <div className="mt-2.5">
                      <label
                        htmlFor={`series-status-${series.id}`}
                        className="sr-only"
                      >
                        Estado de lectura para {series.title}
                      </label>
                      <select
                        id={`series-status-${series.id}`}
                        value={readingStatus}
                        disabled={isBusy}
                        onChange={(e) =>
                          void handleCardStatusChange(series.id, e.target.value)
                        }
                        className={`h-8 w-full rounded-lg border px-2 text-[11px] font-semibold transition-colors focus:border-[var(--accent-primary)] focus:outline-none ${
                          readingStatus
                            ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <option value="">+ Mi lista de lectura</option>
                        {READING_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ZONA 3: Pie con autor clicable y botón Seguir */}
                  <div className="mt-3 flex items-center justify-between gap-1.5 border-t border-[var(--border-subtle)] pt-2.5 transition-colors duration-300">
                    {series.author ? (
                      <button
                        type="button"
                        onClick={() => onOpenAuthorProfile(series.author_id)}
                        className="flex min-w-0 items-center gap-1.5 text-left hover:text-[var(--accent-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded"
                      >
                        <Avatar
                          src={series.author.avatar_url}
                          name={series.author.username}
                          size="sm"
                          className="!h-5 !w-5 !text-[9px] shrink-0"
                        />
                        <span className="truncate text-[11px] font-medium text-[var(--text-secondary)]">
                          {getAuthorDisplayName(series.author)}
                        </span>
                        <OwnerBadge
                          role={series.author.role}
                          badge={series.author.badge}
                          size="xs"
                        />
                      </button>
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Biblioteca Trama
                      </span>
                    )}

                    <FollowButton
                      targetUserId={series.author_id}
                      onOpenAuth={onOpenAuth}
                      size="xs"
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
