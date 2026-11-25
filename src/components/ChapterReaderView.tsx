import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Minus,
  Plus,
} from 'lucide-react';
import { useAchievements } from '../context/AchievementContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  formatChapterNumber,
  getMangaReadingDirection,
  getNovelReaderPrefs,
  isMangaType,
  isVisualSeriesType,
  saveMangaReadingDirection,
  saveNovelReaderPrefs,
  saveReadingProgress,
  type ChapterRecord,
  type MangaReadingDirection,
  type NovelReaderTheme,
  type SeriesRecord,
} from '../lib/library';
import { recordChapterReadingHistory } from '../lib/phase3';
import { isSafeHttpUrl } from '../lib/supabase';
import { CommentSection } from './CommentSection';

interface ChapterReaderViewProps {
  series: SeriesRecord;
  chapters: ChapterRecord[];
  chapterIndex: number;
  onChangeChapterIndex: (nextIndex: number) => void;
  onBackToSeries: () => void;
  onOpenAuth: () => void;
}

const NOVEL_FONT_SIZE_CLASSES: Record<number, string> = {
  15: 'text-[15px]',
  16: 'text-[16px]',
  17: 'text-[17px]',
  18: 'text-[18px]',
  19: 'text-[19px]',
  20: 'text-[20px]',
  21: 'text-[21px]',
  22: 'text-[22px]',
  23: 'text-[23px]',
  24: 'text-[24px]',
};

const NOVEL_THEME_STYLES: Record<
  NovelReaderTheme,
  {
    page: string;
    header: string;
    title: string;
    body: string;
    muted: string;
    button: string;
    activeChip: string;
    divider: string;
  }
> = {
  oscuro: {
    page: 'bg-[#0F1115] text-[#F3F4F6]',
    header: 'bg-[#161920]/95 border-[#262B36] text-[#F3F4F6]',
    title: 'text-[#F3F4F6]',
    body: 'text-[#E2E8F0]',
    muted: 'text-[#9CA3AF]',
    button:
      'border-[#262B36] bg-[#161920] text-[#F3F4F6] hover:bg-[#1E232D]',
    activeChip:
      'bg-[var(--accent-primary)] text-[var(--accent-fg)] font-semibold',
    divider: 'border-[#262B36]',
  },
  sepia: {
    page: 'bg-[#F4ECD8] text-[#2F2418]',
    header: 'bg-[#EFE5CC]/95 border-[#D8C9A8] text-[#2F2418]',
    title: 'text-[#1F160D]',
    body: 'text-[#35291C]',
    muted: 'text-[#6D5B45]',
    button:
      'border-[#D5C5A3] bg-[#EAE0C6] text-[#2F2418] hover:bg-[#E1D4B4]',
    activeChip: 'bg-[#5B4229] text-[#FAF5E9] font-semibold',
    divider: 'border-[#D8C9A8]',
  },
  claro: {
    page: 'bg-[#F8FAFC] text-[#0F172A]',
    header: 'bg-white/95 border-[#E2E8F0] text-[#0F172A]',
    title: 'text-[#0F172A]',
    body: 'text-[#1E293B]',
    muted: 'text-[#475569]',
    button:
      'border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F1F5F9]',
    activeChip:
      'bg-[var(--accent-primary)] text-[var(--accent-fg)] font-semibold',
    divider: 'border-[#E2E8F0]',
  },
};

function ReaderPageImage({
  src,
  pageNumber,
  mode,
}: {
  src: string;
  pageNumber: number;
  mode: 'manhwa' | 'manga';
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!isSafeHttpUrl(src) || hasError) {
    return (
      <div className="flex min-h-[300px] w-full flex-col items-center justify-center gap-2 bg-[#10131A] px-4 text-center text-xs text-[#838D9F]">
        <ImageOff size={24} aria-hidden="true" />
        <span>No se pudo cargar la página {pageNumber}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Página ${pageNumber}`}
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setHasError(true)}
      className={
        mode === 'manga'
          ? 'mx-auto block max-h-[78dvh] w-auto max-w-full object-contain select-none'
          : 'block w-full h-auto select-none'
      }
    />
  );
}

export function ChapterReaderView({
  series,
  chapters,
  chapterIndex,
  onChangeChapterIndex,
  onBackToSeries,
  onOpenAuth,
}: ChapterReaderViewProps) {
  const { user } = useAuth();
  const { checkReadingHistoryAchievement } = useAchievements();
  const { themeMode, fontSizePx } = useTheme();
  const currentChapter = chapters[chapterIndex];
  const prevChapter = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
  const nextChapter =
    chapterIndex < chapters.length - 1 ? chapters[chapterIndex + 1] : null;

  const isManga = isMangaType(series.type);
  const isVisual = isVisualSeriesType(series.type);

  const [novelPrefs, setNovelPrefs] = useState(() => {
    const saved = getNovelReaderPrefs();
    return {
      fontSize: fontSizePx || saved.fontSize,
      theme:
        saved.theme === 'sepia'
          ? 'sepia'
          : themeMode === 'light'
            ? 'claro'
            : 'oscuro',
    } as { fontSize: number; theme: NovelReaderTheme };
  });
  const [showManhwaHud, setShowManhwaHud] = useState(true);
  const [mangaPageIndex, setMangaPageIndex] = useState(0);
  const [mangaDirection, setMangaDirection] = useState<MangaReadingDirection>(
    () => getMangaReadingDirection()
  );

  const totalMangaPages = currentChapter?.image_urls.length ?? 0;

  useEffect(() => {
    setNovelPrefs((prev) => ({
      ...prev,
      fontSize: fontSizePx,
    }));
  }, [fontSizePx]);

  useEffect(() => {
    setMangaPageIndex(0);
  }, [currentChapter?.id]);

  useEffect(() => {
    if (!currentChapter) return;
    saveReadingProgress(
      series.id,
      currentChapter.id,
      currentChapter.chapter_number
    );
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [series.id, currentChapter]);

  // Registra automáticamente el capítulo leído en reading_history de Supabase
  useEffect(() => {
    if (!user?.id || !currentChapter?.id) return;
    void recordChapterReadingHistory(user.id, series.id, currentChapter.id)
      .then(() => checkReadingHistoryAchievement())
      .catch(() => {
        // Ignora fallo auxiliar al registrar historial
      });
  }, [user?.id, series.id, currentChapter?.id, checkReadingHistoryAchievement]);

  const goNextMangaPage = useCallback(() => {
    if (!currentChapter) return;
    if (mangaPageIndex < totalMangaPages - 1) {
      setMangaPageIndex((prev) => Math.min(totalMangaPages - 1, prev + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (nextChapter) {
      onChangeChapterIndex(chapterIndex + 1);
    }
  }, [
    currentChapter,
    mangaPageIndex,
    totalMangaPages,
    nextChapter,
    onChangeChapterIndex,
    chapterIndex,
  ]);

  const goPrevMangaPage = useCallback(() => {
    if (!currentChapter) return;
    if (mangaPageIndex > 0) {
      setMangaPageIndex((prev) => Math.max(0, prev - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (prevChapter) {
      onChangeChapterIndex(chapterIndex - 1);
    }
  }, [
    currentChapter,
    mangaPageIndex,
    prevChapter,
    onChangeChapterIndex,
    chapterIndex,
  ]);

  // Navegación por teclado (ArrowLeft / ArrowRight) respetando dirección Manga/Occidental
  useEffect(() => {
    if (!isManga || !currentChapter) return;
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (mangaDirection === 'rtl') {
          goNextMangaPage();
        } else {
          goPrevMangaPage();
        }
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (mangaDirection === 'rtl') {
          goPrevMangaPage();
        } else {
          goNextMangaPage();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isManga, currentChapter, mangaDirection, goNextMangaPage, goPrevMangaPage]);

  function toggleMangaDirection() {
    setMangaDirection((prev) => {
      const next: MangaReadingDirection = prev === 'rtl' ? 'ltr' : 'rtl';
      saveMangaReadingDirection(next);
      return next;
    });
  }

  function updateFontSize(delta: number) {
    setNovelPrefs((prev) => {
      const next = {
        ...prev,
        fontSize: Math.min(24, Math.max(15, prev.fontSize + delta)),
      };
      saveNovelReaderPrefs(next);
      return next;
    });
  }

  function updateTheme(theme: NovelReaderTheme) {
    setNovelPrefs((prev) => {
      const next = { ...prev, theme };
      saveNovelReaderPrefs(next);
      return next;
    });
  }

  if (!currentChapter) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--bg-base)] px-6 text-center text-[var(--text-main)] transition-colors duration-300">
        <p className="text-base font-medium">Capítulo no disponible.</p>
        <button
          type="button"
          onClick={onBackToSeries}
          className="mt-4 min-h-[44px] rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)]"
        >
          Volver a la obra
        </button>
      </div>
    );
  }

  const chapterLabel = `Capítulo ${formatChapterNumber(
    currentChapter.chapter_number
  )}`;

  // 1. LECTOR DE NOVELA (texto cómodo + tamaño de fuente + Oscuro/Sepia/Claro)
  if (!isVisual) {
    const styles = NOVEL_THEME_STYLES[novelPrefs.theme];
    const paragraphs = (currentChapter.text_content ?? '')
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    return (
      <div className={`min-h-dvh transition-colors duration-200 ${styles.page}`}>
        <header
          className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors duration-200 ${styles.header}`}
        >
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2.5 px-3 py-2.5 sm:px-6">
            <button
              type="button"
              onClick={onBackToSeries}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl px-2 text-sm font-medium opacity-85 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
            >
              <ArrowLeft size={18} aria-hidden="true" />
              <span className="max-w-[130px] truncate sm:max-w-[220px]">
                {series.title}
              </span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <div
                aria-label="Tamaño de letra"
                className={`inline-flex items-center rounded-xl border p-0.5 ${styles.divider}`}
              >
                <button
                  type="button"
                  onClick={() => updateFontSize(-1)}
                  disabled={novelPrefs.fontSize <= 15}
                  aria-label="Reducir tamaño de letra"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg disabled:opacity-35 hover:bg-black/10 transition-colors"
                >
                  <Minus size={14} aria-hidden="true" />
                </button>
                <span className="px-2 text-xs font-semibold tabular-nums">
                  {novelPrefs.fontSize}px
                </span>
                <button
                  type="button"
                  onClick={() => updateFontSize(1)}
                  disabled={novelPrefs.fontSize >= 24}
                  aria-label="Aumentar tamaño de letra"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg disabled:opacity-35 hover:bg-black/10 transition-colors"
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>

              <div
                role="radiogroup"
                aria-label="Fondo de lectura"
                className={`inline-flex items-center gap-0.5 rounded-xl border p-0.5 ${styles.divider}`}
              >
                {(
                  [
                    { id: 'oscuro', label: 'Oscuro' },
                    { id: 'sepia', label: 'Sepia' },
                    { id: 'claro', label: 'Claro' },
                  ] as const
                ).map((option) => {
                  const isActive = novelPrefs.theme === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => updateTheme(option.id)}
                      className={`min-h-[36px] rounded-lg px-2.5 text-xs transition-colors whitespace-nowrap ${
                        isActive
                          ? styles.activeChip
                          : 'opacity-75 hover:opacity-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
          <div className={`border-b pb-6 ${styles.divider}`}>
            <p className={`text-xs font-medium ${styles.muted}`}>
              {series.title} · {chapterLabel}
            </p>
            <h1
              className={`mt-2 text-balance font-display text-2xl font-bold leading-snug sm:text-3xl ${styles.title}`}
            >
              {currentChapter.title
                ? `${chapterLabel}: ${currentChapter.title}`
                : chapterLabel}
            </h1>
          </div>

          <article
            className={`mx-auto mt-8 max-w-[66ch] space-y-6 leading-[1.85] break-words ${
              NOVEL_FONT_SIZE_CLASSES[novelPrefs.fontSize] ?? 'text-[18px]'
            } ${styles.body}`}
          >
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line">
                  {paragraph}
                </p>
              ))
            ) : (
              <p className={`text-sm ${styles.muted}`}>
                Este capítulo no tiene contenido de texto disponible.
              </p>
            )}
          </article>

          <nav
            aria-label="Navegación de capítulos"
            className={`mt-14 border-t pt-8 ${styles.divider}`}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!prevChapter}
                onClick={() =>
                  prevChapter && onChangeChapterIndex(chapterIndex - 1)
                }
                className={`min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${styles.button}`}
              >
                <ChevronLeft size={18} aria-hidden="true" />
                <span>Capítulo anterior</span>
              </button>

              <button
                type="button"
                disabled={!nextChapter}
                onClick={() =>
                  nextChapter && onChangeChapterIndex(chapterIndex + 1)
                }
                className={`min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${styles.button}`}
              >
                <span>Siguiente capítulo</span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={onBackToSeries}
                className={`min-h-[44px] rounded-xl px-4 text-xs font-medium opacity-80 hover:opacity-100 transition-opacity ${styles.muted}`}
              >
                Volver a la lista de capítulos
              </button>
            </div>
          </nav>

          <div className="mt-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 pb-6 text-[var(--text-main)] sm:px-6 transition-colors duration-300">
            <CommentSection
              key={currentChapter.id}
              chapterId={currentChapter.id}
              heading={`Comentarios · ${chapterLabel}`}
              placeholder="Comparte tu reacción o teoría sobre este capítulo…"
              onOpenAuth={onOpenAuth}
            />
          </div>
        </main>
      </div>
    );
  }

  // 2. LECTOR DE MANGA (Paginado: Página X de Y, Anterior/Siguiente, bordes clicables, flechas y RTL/LTR)
  if (isManga) {
    const safePageIndex = Math.min(
      Math.max(0, mangaPageIndex),
      Math.max(0, totalMangaPages - 1)
    );
    const activePageUrl = currentChapter.image_urls[safePageIndex] ?? null;
    const isRtl = mangaDirection === 'rtl';
    const progressPercent =
      totalMangaPages > 0
        ? Math.round(((safePageIndex + 1) / totalMangaPages) * 100)
        : 0;
    const canGoPrev = safePageIndex > 0 || Boolean(prevChapter);
    const canGoNext = safePageIndex < totalMangaPages - 1 || Boolean(nextChapter);

    return (
      <div className="min-h-dvh bg-[#07090D] text-white flex flex-col">
        {/* Cabecera limpia del Lector Paginado */}
        <header className="sticky top-0 z-40 border-b border-white/[0.1] bg-[#0B0E14]/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={onBackToSeries}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-[#E5E9F0] hover:bg-white/[0.08] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <ArrowLeft size={18} aria-hidden="true" />
                <span className="max-w-[120px] truncate sm:max-w-[220px]">
                  {series.title}
                </span>
              </button>

              <span className="hidden sm:inline-flex rounded-md bg-gradient-to-r from-rose-600/90 to-pink-600/90 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
                Manga
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {totalMangaPages > 0 && (
                <span className="rounded-lg border border-white/12 bg-white/[0.05] px-2.5 py-1.5 text-xs font-bold tabular-nums text-white">
                  Página {safePageIndex + 1} de {totalMangaPages}
                </span>
              )}

              <button
                type="button"
                onClick={toggleMangaDirection}
                title="Cambiar dirección de lectura"
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <ArrowLeftRight size={14} aria-hidden="true" />
                <span>
                  {isRtl
                    ? 'Manga (Der → Izq)'
                    : 'Occidental (Izq → Der)'}
                </span>
              </button>
            </div>
          </div>

          {/* Barra de progreso fina de páginas */}
          {totalMangaPages > 0 && (
            <div className="h-1 w-full bg-white/[0.08]">
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-fuchsia-500 transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </header>

        {/* Escenario paginado central con zonas clicables izquierda / derecha */}
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-2 py-4 sm:px-6 sm:py-6">
          <div className="mb-3 flex w-full flex-wrap items-center justify-between gap-2 px-1 text-xs text-[#9AA4B4]">
            <p className="truncate font-semibold text-white">
              {chapterLabel}
              {currentChapter.title ? ` · ${currentChapter.title}` : ''}
            </p>
            <p className="text-[11px]">
              {isRtl
                ? 'Toca el borde izquierdo o ← para avanzar'
                : 'Toca el borde derecho o → para avanzar'}
            </p>
          </div>

          {activePageUrl ? (
            <div className="relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0B0E14] min-h-[55dvh]">
              <ReaderPageImage
                src={activePageUrl}
                pageNumber={safePageIndex + 1}
                mode="manga"
              />

              {/* Zona interactiva izquierda (38%): en RTL avanza, en LTR retrocede */}
              <button
                type="button"
                onClick={isRtl ? goNextMangaPage : goPrevMangaPage}
                disabled={isRtl ? !canGoNext : !canGoPrev}
                aria-label={
                  isRtl ? 'Página siguiente' : 'Página anterior'
                }
                className="group absolute inset-y-0 left-0 z-10 flex w-[38%] items-center justify-start pl-3 text-white/0 hover:bg-gradient-to-r hover:from-black/35 hover:to-transparent hover:text-white/90 disabled:pointer-events-none transition-all focus-visible:outline-none"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                  <ChevronLeft size={22} aria-hidden="true" />
                </span>
              </button>

              {/* Zona interactiva derecha (38%): en RTL retrocede, en LTR avanza */}
              <button
                type="button"
                onClick={isRtl ? goPrevMangaPage : goNextMangaPage}
                disabled={isRtl ? !canGoPrev : !canGoNext}
                aria-label={
                  isRtl ? 'Página anterior' : 'Página siguiente'
                }
                className="group absolute inset-y-0 right-0 z-10 flex w-[38%] items-center justify-end pr-3 text-white/0 hover:bg-gradient-to-l hover:from-black/35 hover:to-transparent hover:text-white/90 disabled:pointer-events-none transition-all focus-visible:outline-none"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                  <ChevronRight size={22} aria-hidden="true" />
                </span>
              </button>
            </div>
          ) : (
            <div className="flex min-h-[55dvh] w-full flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#0B0E14] px-6 text-center text-[#8B95A5]">
              <ImageOff size={28} aria-hidden="true" />
              <p className="mt-3 text-sm">
                Este capítulo no tiene páginas cargadas todavía.
              </p>
            </div>
          )}

          {/* Controles grandes Anterior / Selector de página / Siguiente */}
          <div className="mt-4 w-full space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={!canGoPrev}
                onClick={goPrevMangaPage}
                className="min-h-[50px] sm:min-w-[168px] inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#141822] px-4 py-3 text-sm font-bold text-white hover:bg-[#1C2230] disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} aria-hidden="true" />
                <span>
                  {safePageIndex === 0 && prevChapter
                    ? 'Cap. anterior'
                    : 'Anterior'}
                </span>
              </button>

              {totalMangaPages > 0 && (
                <div className="col-span-2 order-3 sm:order-2 flex items-center justify-center gap-2.5">
                  <label htmlFor="manga-page-select" className="sr-only">
                    Ir a la página
                  </label>
                  <select
                    id="manga-page-select"
                    value={safePageIndex}
                    onChange={(e) => {
                      setMangaPageIndex(Number(e.target.value));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="min-h-[44px] rounded-xl border border-white/15 bg-[#141822] px-3.5 text-xs font-semibold text-white tabular-nums focus:border-rose-500 focus:outline-none"
                  >
                    {currentChapter.image_urls.map((_, idx) => (
                      <option
                        key={idx}
                        value={idx}
                        className="bg-[#141822] text-white"
                      >
                        Página {idx + 1} de {totalMangaPages}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                disabled={!canGoNext}
                onClick={goNextMangaPage}
                className="min-h-[50px] sm:min-w-[168px] order-2 sm:order-3 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-fuchsia-600 px-4 py-3 text-sm font-bold text-white hover:brightness-110 disabled:opacity-35 disabled:cursor-not-allowed transition-all"
              >
                <span>
                  {safePageIndex === totalMangaPages - 1 && nextChapter
                    ? 'Siguiente cap.'
                    : 'Siguiente'}
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </main>

        {/* Navegación entre capítulos y comentarios del episodio */}
        <footer className="mt-6 border-t border-white/[0.08] bg-[#090B0E] px-4 py-8 pb-16">
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#97A1B2]">
              <button
                type="button"
                disabled={!prevChapter}
                onClick={() =>
                  prevChapter && onChangeChapterIndex(chapterIndex - 1)
                }
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#131720] px-3.5 font-semibold text-white hover:bg-[#1B212E] disabled:opacity-35 transition-colors"
              >
                <ChevronLeft size={15} aria-hidden="true" />
                <span>Capítulo anterior</span>
              </button>

              <button
                type="button"
                onClick={onBackToSeries}
                className="min-h-[40px] rounded-xl px-3 font-medium text-[#97A1B2] hover:text-white transition-colors"
              >
                Lista de capítulos
              </button>

              <button
                type="button"
                disabled={!nextChapter}
                onClick={() =>
                  nextChapter && onChangeChapterIndex(chapterIndex + 1)
                }
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#131720] px-3.5 font-semibold text-white hover:bg-[#1B212E] disabled:opacity-35 transition-colors"
              >
                <span>Siguiente capítulo</span>
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 pb-6 text-[var(--text-main)] sm:px-6 transition-colors duration-300">
              <CommentSection
                key={currentChapter.id}
                chapterId={currentChapter.id}
                heading={`Comentarios · ${chapterLabel}`}
                placeholder="Comparte tu reacción o teoría sobre este capítulo…"
                onOpenAuth={onOpenAuth}
              />
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // 3. LECTOR DE MANHWA / WEBTOON (vertical continuo sin espacios blancos + HUD al toque)
  return (
    <div className="min-h-dvh bg-[#050608] text-white">
      <header
        className={`fixed inset-x-0 top-0 z-40 border-b border-white/[0.1] bg-[#090B0E]/92 backdrop-blur-md transition-all duration-200 ${
          showManhwaHud
            ? 'translate-y-0 opacity-100'
            : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-3 sm:px-6">
          <button
            type="button"
            onClick={onBackToSeries}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl px-2 text-sm font-medium text-[#E5E9F0] hover:bg-white/[0.06] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            <span className="max-w-[140px] truncate sm:max-w-[260px]">
              {series.title}
            </span>
          </button>

          <div className="text-right min-w-0">
            <p className="truncate text-xs font-semibold text-white tabular-nums">
              {chapterLabel}
              {currentChapter.title ? ` · ${currentChapter.title}` : ''}
            </p>
            <p className="text-[11px] tabular-nums text-[#8B95A5]">
              {currentChapter.image_urls.length}{' '}
              {currentChapter.image_urls.length === 1 ? 'página' : 'páginas'} ·
              Scroll continuo
            </p>
          </div>
        </div>
      </header>

      <main
        onClick={() => setShowManhwaHud((prev) => !prev)}
        className="w-full cursor-pointer md:mx-auto md:max-w-3xl"
      >
        {currentChapter.image_urls.length > 0 ? (
          <div className="flex flex-col gap-0 leading-none">
            {currentChapter.image_urls.map((url, idx) => (
              <ReaderPageImage
                key={`${currentChapter.id}-${idx}`}
                src={url}
                pageNumber={idx + 1}
                mode="manhwa"
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center text-[#8B95A5]">
            <ImageOff size={28} aria-hidden="true" />
            <p className="mt-3 text-sm">
              Este capítulo no tiene páginas cargadas todavía.
            </p>
          </div>
        )}
      </main>

      <footer className="border-t border-white/[0.08] bg-[#090B0E] px-4 py-8 pb-24 md:pb-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-center text-xs font-medium text-[#8B95A5]">
            Fin de {chapterLabel}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={!prevChapter}
              onClick={() =>
                prevChapter && onChangeChapterIndex(chapterIndex - 1)
              }
              className="min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-[#131720] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1A202D] disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={18} aria-hidden="true" />
              <span>Capítulo anterior</span>
            </button>

            <button
              type="button"
              disabled={!nextChapter}
              onClick={() =>
                nextChapter && onChangeChapterIndex(chapterIndex + 1)
              }
              className="min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-35 disabled:cursor-not-allowed transition-all"
            >
              <span>Siguiente capítulo</span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={onBackToSeries}
              className="min-h-[44px] rounded-xl px-4 text-xs font-medium text-[#97A1B2] hover:text-white transition-colors"
            >
              Volver a {series.title}
            </button>
          </div>

          <div className="mt-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 pb-6 text-[var(--text-main)] sm:px-6 transition-colors duration-300">
            <CommentSection
              key={currentChapter.id}
              chapterId={currentChapter.id}
              heading={`Comentarios · ${chapterLabel}`}
              placeholder="Comparte tu reacción o teoría sobre este episodio…"
              onOpenAuth={onOpenAuth}
            />
          </div>
        </div>
      </footer>

      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.1] bg-[#090B0E]/92 backdrop-blur-md pb-safe transition-all duration-200 ${
          showManhwaHud
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <button
            type="button"
            disabled={!prevChapter}
            onClick={() =>
              prevChapter && onChangeChapterIndex(chapterIndex - 1)
            }
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[#E2E8F0] hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            <span>Anterior</span>
          </button>

          <button
            type="button"
            onClick={onBackToSeries}
            className="min-h-[42px] rounded-xl px-3 text-xs font-medium text-[#97A1B2] hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            Capítulos
          </button>

          <button
            type="button"
            disabled={!nextChapter}
            onClick={() =>
              nextChapter && onChangeChapterIndex(chapterIndex + 1)
            }
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-fuchsia-300 hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
          >
            <span>Siguiente</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
