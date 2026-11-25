import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Minus,
  Plus,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  formatChapterNumber,
  getNovelReaderPrefs,
  isManhwaType,
  saveNovelReaderPrefs,
  saveReadingProgress,
  type ChapterRecord,
  type NovelReaderTheme,
  type SeriesRecord,
} from '../lib/library';
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

function ManhwaPageImage({
  src,
  pageNumber,
}: {
  src: string;
  pageNumber: number;
}) {
  const [hasError, setHasError] = useState(false);

  if (!isSafeHttpUrl(src) || hasError) {
    return (
      <div className="flex min-h-[240px] w-full flex-col items-center justify-center gap-2 bg-[#10131A] px-4 text-center text-xs text-[#838D9F]">
        <ImageOff size={22} aria-hidden="true" />
        <span>No se pudo cargar la página {pageNumber}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Página ${pageNumber}`}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className="block w-full h-auto select-none"
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
  const { themeMode, fontSizePx } = useTheme();
  const currentChapter = chapters[chapterIndex];
  const prevChapter = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
  const nextChapter =
    chapterIndex < chapters.length - 1 ? chapters[chapterIndex + 1] : null;

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

  useEffect(() => {
    setNovelPrefs((prev) => ({
      ...prev,
      fontSize: fontSizePx,
    }));
  }, [fontSizePx]);

  useEffect(() => {
    if (!currentChapter) return;
    saveReadingProgress(
      series.id,
      currentChapter.id,
      currentChapter.chapter_number
    );
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [series.id, currentChapter]);

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
  if (!isManhwaType(series.type)) {
    const styles = NOVEL_THEME_STYLES[novelPrefs.theme];
    const paragraphs = (currentChapter.text_content ?? '')
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    return (
      <div className={`min-h-dvh transition-colors duration-200 ${styles.page}`}>
        {/* Barra superior de controles del lector */}
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
              {/* Tamaño de letra */}
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

              {/* Fondo de lectura: Oscuro / Sepia / Claro */}
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
                        isActive ? styles.activeChip : 'opacity-75 hover:opacity-100'
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

        {/* Cuerpo de lectura */}
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

          {/* Navegación inferior entre capítulos */}
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

          {/* Comentarios específicos de este capítulo */}
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

  // 2. LECTOR DE MANHWA (webtoon vertical continuo sin espacios blancos + HUD al toque)
  return (
    <div className="min-h-dvh bg-[#050608] text-white">
      {/* Barra superior flotante controlada al toque */}
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
              Toca para ocultar controles
            </p>
          </div>
        </div>
      </header>

      {/* Lienzo vertical continuo sin espacios blancos entre imágenes */}
      <main
        onClick={() => setShowManhwaHud((prev) => !prev)}
        className="w-full cursor-pointer md:mx-auto md:max-w-3xl"
      >
        {currentChapter.image_urls.length > 0 ? (
          <div className="flex flex-col gap-0 leading-none">
            {currentChapter.image_urls.map((url, idx) => (
              <ManhwaPageImage
                key={`${currentChapter.id}-${idx}`}
                src={url}
                pageNumber={idx + 1}
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

      {/* Navegación fija al final del capítulo (siempre accesible al terminar) */}
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
              className="min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#388BFF] px-4 py-3 text-sm font-semibold text-[#06101F] hover:bg-[#529BFF] disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
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

          {/* Comentarios específicos de este capítulo */}
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

      {/* Barra inferior flotante rápida controlada al toque */}
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
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[#8EC0FF] hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
          >
            <span>Siguiente</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
