import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  AlertCircle,
  BookOpen,
  BookPlus,
  Columns2,
  ImagePlus,
  Loader2,
  Save,
  ScrollText,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  SERIES_GENRES,
  SERIES_STATUSES,
  createSeries,
  normalizeSeriesType,
  updateSeries,
  uploadSeriesCover,
  type SeriesRecord,
  type SeriesStatus,
  type SeriesType,
} from '../lib/library';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '../lib/posts';
import { CategoryCoverArtwork } from './CategoryCoverArtwork';

interface CreateSeriesModalProps {
  isOpen: boolean;
  initialSeries?: SeriesRecord | null;
  onClose: () => void;
  onCreated?: (created: SeriesRecord) => void;
  onSaved?: (updated: SeriesRecord) => void;
}

const MAX_TITLE_LENGTH = 120;
const MAX_SYNOPSIS_LENGTH = 1800;

const FORMAT_OPTIONS: {
  id: SeriesType;
  label: string;
  hint: string;
  activeClass: string;
}[] = [
  {
    id: 'manga',
    label: 'Manga',
    hint: 'Lectura paginada',
    activeClass:
      'border-rose-500/60 bg-gradient-to-br from-rose-500/18 to-pink-500/18 text-rose-700 dark:text-rose-200 shadow-xs',
  },
  {
    id: 'manhwa',
    label: 'Manhwa / Webtoon',
    hint: 'Scroll vertical',
    activeClass:
      'border-fuchsia-500/60 bg-gradient-to-br from-violet-500/18 to-fuchsia-500/18 text-fuchsia-700 dark:text-fuchsia-200 shadow-xs',
  },
  {
    id: 'novela',
    label: 'Novela',
    hint: 'Lectura de texto',
    activeClass:
      'border-indigo-500/60 bg-gradient-to-br from-indigo-500/18 to-blue-500/18 text-indigo-700 dark:text-indigo-200 shadow-xs',
  },
];

export function CreateSeriesModal({
  isOpen,
  initialSeries = null,
  onClose,
  onCreated,
  onSaved,
}: CreateSeriesModalProps) {
  const { user, isOwner } = useAuth();
  const isEditing = Boolean(initialSeries);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<SeriesType>('manga');
  const [genre, setGenre] = useState<string>(SERIES_GENRES[0]);
  const [status, setStatus] = useState<SeriesStatus>('En emisión');
  const [synopsis, setSynopsis] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    if (initialSeries) {
      setTitle(initialSeries.title);
      setType(normalizeSeriesType(initialSeries.type));
      setGenre(initialSeries.genre || SERIES_GENRES[0]);
      setStatus(
        initialSeries.status === 'Finalizado' ? 'Finalizado' : 'En emisión'
      );
      setSynopsis(initialSeries.synopsis ?? '');
      setExistingCoverUrl(initialSeries.cover_url ?? null);
      setCoverFile(null);
      setCoverPreview(null);
    } else {
      setTitle('');
      setType('manga');
      setGenre(SERIES_GENRES[0]);
      setStatus('En emisión');
      setSynopsis('');
      setExistingCoverUrl(null);
      setCoverFile(null);
      setCoverPreview(null);
    }
  }, [isOpen, initialSeries]);

  useEffect(() => {
    return () => {
      if (coverPreview) {
        URL.revokeObjectURL(coverPreview);
      }
    };
  }, [coverPreview]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  function clearCover() {
    if (coverPreview) {
      URL.revokeObjectURL(coverPreview);
    }
    setCoverFile(null);
    setCoverPreview(null);
    setExistingCoverUrl(null);
  }

  function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setErrorMsg(null);

    if (!ALLOWED_IMAGE_TYPES[file.type]) {
      setErrorMsg('Formato de portada no permitido. Usa JPG, PNG, WebP o GIF.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setErrorMsg('La portada supera el límite de 5 MB.');
      return;
    }

    if (coverPreview) {
      URL.revokeObjectURL(coverPreview);
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function resetForm() {
    setTitle('');
    setType('manga');
    setGenre(SERIES_GENRES[0]);
    setStatus('En emisión');
    setSynopsis('');
    clearCover();
    setErrorMsg(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setErrorMsg('Debes iniciar sesión para guardar una obra.');
      return;
    }

    setErrorMsg(null);
    const trimmedTitle = title.trim();
    const trimmedSynopsis = synopsis.trim();

    if (!trimmedTitle) {
      setErrorMsg('Ingresa el título de la obra.');
      return;
    }

    if (!trimmedSynopsis) {
      setErrorMsg('Escribe una sinopsis para presentar tu obra.');
      return;
    }

    setIsSubmitting(true);

    try {
      let coverUrl: string | null = existingCoverUrl;
      if (coverFile) {
        coverUrl = await uploadSeriesCover(coverFile, user.id);
      }

      if (initialSeries) {
        const updated = await updateSeries({
          seriesId: initialSeries.id,
          userId: user.id,
          isOwner,
          title: trimmedTitle,
          type,
          genre,
          status,
          synopsis: trimmedSynopsis,
          coverUrl,
        });
        onClose();
        onSaved?.(updated);
      } else {
        const created = await createSeries({
          authorId: user.id,
          title: trimmedTitle,
          type,
          genre,
          status,
          synopsis: trimmedSynopsis,
          coverUrl,
        });

        resetForm();
        onClose();
        onCreated?.(created);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEditing
            ? 'No se pudieron guardar los cambios de la obra.'
            : 'No se pudo registrar la obra. Inténtalo de nuevo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const displayedCoverSrc = coverPreview || existingCoverUrl;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-series-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl transition-colors duration-300 sm:rounded-2xl">
        <div className="shrink-0 border-b border-[var(--border-subtle)] px-5 pt-3 pb-4 sm:px-6 sm:pt-5">
          <div
            aria-hidden="true"
            className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden"
          />

          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                id="create-series-title"
                className="font-display text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl"
              >
                {isEditing ? 'Editar Obra' : 'Nueva Obra'}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {isEditing
                  ? 'Actualiza el formato, género, sinopsis o portada de tu serie.'
                  : 'Registra un manga, manhwa/webtoon o novela en Biblioteca.'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Cerrar formulario"
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
          {/* Formato de obra: Manga / Manhwa / Novela */}
          <div>
            <span className="mb-2 block text-xs font-semibold text-[var(--text-secondary)]">
              Formato de lectura
            </span>
            <div
              role="radiogroup"
              aria-label="Formato de la obra"
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              {FORMAT_OPTIONS.map((opt) => {
                const isSelected = type === opt.id;
                const Icon =
                  opt.id === 'manga'
                    ? Columns2
                    : opt.id === 'manhwa'
                      ? ScrollText
                      : BookOpen;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setType(opt.id)}
                    className={`min-h-[62px] flex flex-col items-start justify-center gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                      isSelected
                        ? opt.activeClass
                        : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold leading-tight">
                      <Icon size={14} aria-hidden="true" />
                      <span>{opt.label}</span>
                    </span>
                    <span className="text-[11px] opacity-80">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Título */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="series-title"
                className="block text-sm font-medium text-[var(--text-main)]"
              >
                Título
              </label>
              <span className="text-xs tabular-nums text-[var(--text-muted)]">
                {title.length} / {MAX_TITLE_LENGTH}
              </span>
            </div>
            <input
              id="series-title"
              type="text"
              required
              maxLength={MAX_TITLE_LENGTH}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Crónicas del Alba o Sombras de Kioto"
              className="min-h-[46px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 transition-colors"
            />
          </div>

          {/* Género y Estado */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="series-genre"
                className="mb-1.5 block text-sm font-medium text-[var(--text-main)]"
              >
                Género
              </label>
              <select
                id="series-genre"
                value={genre}
                onChange={(event) => setGenre(event.target.value)}
                className="min-h-[46px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 text-sm text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 transition-colors"
              >
                {SERIES_GENRES.map((item) => (
                  <option
                    key={item}
                    value={item}
                    className="bg-[var(--bg-card)] text-[var(--text-main)]"
                  >
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-main)]">
                Estado
              </span>
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1">
                {SERIES_STATUSES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStatus(item)}
                    className={`min-h-[36px] rounded-lg px-2 text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                      status === item
                        ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sinopsis */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="series-synopsis"
                className="block text-sm font-medium text-[var(--text-main)]"
              >
                Sinopsis
              </label>
              <span className="text-xs tabular-nums text-[var(--text-muted)]">
                {synopsis.length} / {MAX_SYNOPSIS_LENGTH}
              </span>
            </div>
            <textarea
              id="series-synopsis"
              rows={4}
              required
              maxLength={MAX_SYNOPSIS_LENGTH}
              value={synopsis}
              onChange={(event) => setSynopsis(event.target.value)}
              placeholder="Resume la premisa de tu historia sin adelantar giros clave…"
              className="w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-3 text-sm leading-relaxed text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 transition-colors"
            />
          </div>

          {/* Portada */}
          <div>
            <span className="mb-2 block text-sm font-medium text-[var(--text-main)]">
              Portada vertical (recomendado 3:4)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleCoverChange}
              className="sr-only"
              aria-label="Seleccionar portada de la obra"
            />

            {displayedCoverSrc ? (
              <div className="flex items-start gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3">
                <img
                  src={displayedCoverSrc}
                  alt="Vista previa de la portada"
                  className="aspect-[3/4] w-24 shrink-0 rounded-lg object-cover border border-[var(--border-subtle)]"
                />
                <div className="min-w-0 flex-1 space-y-2 pt-1">
                  <p className="text-xs font-medium text-[var(--text-main)] truncate">
                    {coverFile?.name || 'Portada actual'}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {coverFile
                      ? 'Lista para subirse al bucket media.'
                      : 'Puedes conservar esta portada o subir una nueva.'}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting}
                      className="min-h-[38px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors"
                    >
                      Cambiar
                    </button>
                    <button
                      type="button"
                      onClick={clearCover}
                      disabled={isSubmitting}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 px-3 text-xs font-medium text-red-600 dark:text-red-300 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      <span>Quitar</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3.5 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3">
                <CategoryCoverArtwork
                  category={genre}
                  title={title || genre}
                  fallbackMode={type}
                  variant="portrait"
                  className="aspect-[3/4] w-20 shrink-0 rounded-lg border border-white/10"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-xs font-medium text-[var(--text-main)]">
                    Portada ilustrada automática
                  </p>
                  <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    Si no subes una imagen, se mostrará esta portada temática.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="min-h-[38px] inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-elevated)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                  >
                    <ImagePlus size={15} aria-hidden="true" />
                    <span>Subir portada propia</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-700 dark:text-red-200"
            >
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0 text-red-500 dark:text-red-400"
                aria-hidden="true"
              />
              <span>{errorMsg}</span>
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
                  <span>{isEditing ? 'Guardando…' : 'Registrando…'}</span>
                </>
              ) : isEditing ? (
                <>
                  <Save size={17} aria-hidden="true" />
                  <span>Guardar cambios</span>
                </>
              ) : (
                <>
                  <BookPlus size={17} aria-hidden="true" />
                  <span>Registrar obra</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
