import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchSeriesCatalog,
  type SeriesRecord,
  type SeriesType,
} from '../lib/library';
import { MediaImage } from './MediaImage';

export type BibliotecaFilter = 'todas' | SeriesType;

interface BibliotecaCatalogProps {
  selectedFilter: BibliotecaFilter;
  onSelectFilter: (filter: BibliotecaFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  refreshKey: number;
  deletedSeriesId: string | null;
  onSelectSeries: (series: SeriesRecord) => void;
  onOpenCreateSeries: () => void;
  onOpenAuth: () => void;
}

const FILTER_TABS: { id: BibliotecaFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'novela', label: 'Novelas' },
  { id: 'manhwa', label: 'Manhwas' },
];

export function BibliotecaCatalog({
  selectedFilter,
  onSelectFilter,
  searchQuery,
  onSearchQueryChange,
  refreshKey,
  deletedSeriesId,
  onSelectSeries,
  onOpenCreateSeries,
  onOpenAuth,
}: BibliotecaCatalogProps) {
  const { isAuthenticated } = useAuth();
  const [seriesList, setSeriesList] = useState<SeriesRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchSeriesCatalog();
      setSeriesList(data);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el catálogo de Biblioteca.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      if (selectedFilter !== 'todas' && item.type !== selectedFilter) {
        return false;
      }
      if (normalizedQuery) {
        return item.title.toLowerCase().includes(normalizedQuery);
      }
      return true;
    });
  }, [seriesList, selectedFilter, searchQuery]);

  return (
    <section
      aria-labelledby="biblioteca-heading"
      className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 md:px-8 md:py-10 md:pb-20"
    >
      {/* Cabecera de Biblioteca + botón "+ Nueva Obra" */}
      <div className="border-b border-white/[0.08] pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              id="biblioteca-heading"
              className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl"
            >
              Biblioteca
            </h1>
            <p className="mt-1 text-sm text-[#8F99AB]">
              Catálogo de novelas web y manhwas por capítulos.
            </p>
          </div>

          {isAuthenticated && (
            <button
              type="button"
              onClick={onOpenCreateSeries}
              className="min-h-[44px] self-start sm:self-auto inline-flex items-center gap-2 rounded-xl bg-[#388BFF] px-4 py-2.5 text-sm font-semibold text-[#06101F] hover:bg-[#529BFF] active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
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
            className="flex items-center gap-1.5"
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
                  className={`min-h-[42px] rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] ${
                    isActive
                      ? 'bg-[#1D2432] text-white border border-white/[0.12]'
                      : 'text-[#8F99AB] border border-transparent hover:bg-white/[0.04] hover:text-[#E5E9F0]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:max-w-xs">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7D8799]"
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
              className="min-h-[44px] w-full rounded-xl border border-white/[0.1] bg-[#11151D] pl-10 pr-10 text-sm text-white placeholder:text-[#667085] focus:border-[#388BFF] focus:outline-none focus:ring-2 focus:ring-[#388BFF]/30 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchQueryChange('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#8F99AB] hover:text-white transition-colors"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Estados del catálogo */}
      {isLoading ? (
        <div className="mt-7 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
            <div key={item} className="space-y-2.5">
              <div className="aspect-[3/4] w-full rounded-2xl bg-[#131720] border border-white/[0.06]" />
              <div className="h-4 w-4/5 rounded bg-[#181E2B]" />
              <div className="h-3 w-1/2 rounded bg-[#141924]" />
            </div>
          ))}
        </div>
      ) : errorMsg ? (
        <div
          role="alert"
          className="mt-8 flex flex-col gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="shrink-0 text-red-400" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadCatalog()}
            className="min-h-[40px] self-start sm:self-auto rounded-xl bg-white/[0.1] px-4 text-xs font-semibold text-white hover:bg-white/[0.16] transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : filteredSeries.length === 0 ? (
        <div className="mx-auto mt-14 flex max-w-md flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-[#10141C] px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#161C27] text-[#7FB2FF]">
            <BookOpen size={22} aria-hidden="true" />
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold text-white">
            {searchQuery.trim()
              ? 'No encontramos obras con ese título'
              : selectedFilter === 'todas'
                ? 'La Biblioteca aún está vacía'
                : selectedFilter === 'novela'
                  ? 'Todavía no hay novelas registradas'
                  : 'Todavía no hay manhwas registrados'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#8F99AB]">
            {searchQuery.trim()
              ? 'Prueba con otra palabra o limpia el buscador para ver todo el catálogo.'
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
                className="min-h-[44px] rounded-xl border border-white/[0.12] px-4 py-2 text-sm font-medium text-[#E2E7F0] hover:bg-white/[0.05] transition-colors"
              >
                Ver todo el catálogo
              </button>
            )}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onOpenCreateSeries}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#388BFF] px-4 py-2 text-sm font-semibold text-[#06101F] hover:bg-[#529BFF] transition-colors"
              >
                <Plus size={16} aria-hidden="true" />
                <span>Nueva Obra</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="min-h-[44px] rounded-xl bg-[#388BFF] px-4 py-2 text-sm font-semibold text-[#06101F] hover:bg-[#529BFF] transition-colors"
              >
                Iniciar sesión para publicar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-2 gap-3.5 sm:gap-5 md:grid-cols-4">
          {filteredSeries.map((series) => {
            const isManhwa = series.type === 'manhwa';
            return (
              <button
                key={series.id}
                type="button"
                onClick={() => onSelectSeries(series)}
                className="group flex flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] rounded-2xl"
              >
                {/* Portada vertical 3:4 estilo Olympus / Novelive */}
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#131720] transition-colors duration-150 group-hover:border-white/[0.2]">
                  {series.cover_url ? (
                    <MediaImage
                      src={series.cover_url}
                      alt={`Portada de ${series.title}`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      fallbackClassName="h-full w-full"
                    />
                  ) : (
                    <div
                      className={`flex h-full w-full flex-col justify-end p-4 ${
                        isManhwa
                          ? 'bg-gradient-to-br from-[#2B2012] via-[#171412] to-[#0E1118]'
                          : 'bg-gradient-to-br from-[#13233C] via-[#111622] to-[#0C0F16]'
                      }`}
                    >
                      <BookOpen
                        size={28}
                        className="mb-auto text-white/25"
                        aria-hidden="true"
                      />
                    </div>
                  )}

                  {/* Scrim inferior medido para alto contraste */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 via-black/45 to-transparent"
                  />

                  {/* Etiqueta de color indicando Novela o Manhwa */}
                  <span
                    className={`absolute left-2.5 top-2.5 rounded-lg px-2 py-1 text-[11px] font-semibold tracking-wide backdrop-blur-sm ${
                      isManhwa
                        ? 'bg-[#B45309]/90 text-[#FEF3C7]'
                        : 'bg-[#1D4ED8]/90 text-[#DBEAFE]'
                    }`}
                  >
                    {isManhwa ? 'Manhwa' : 'Novela'}
                  </span>

                  {/* Estado sobre el borde inferior */}
                  <div className="absolute inset-x-3 bottom-2.5 flex items-center justify-between gap-2 text-[11px] font-medium text-white/90">
                    <span className="truncate">{series.status}</span>
                    {series.chapters_count > 0 && (
                      <span className="shrink-0 tabular-nums text-white/75">
                        {series.chapters_count}{' '}
                        {series.chapters_count === 1 ? 'cap.' : 'caps.'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Título y género debajo de la portada */}
                <div className="mt-2.5 px-0.5">
                  <h2 className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-[#F3F5FA] group-hover:text-[#9CC6FF] transition-colors sm:text-base">
                    {series.title}
                  </h2>
                  <p className="mt-1 truncate text-xs text-[#838D9F]">
                    {series.genre}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
