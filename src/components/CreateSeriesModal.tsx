import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  AlertCircle,
  BookPlus,
  ImagePlus,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  SERIES_GENRES,
  SERIES_STATUSES,
  createSeries,
  uploadSeriesCover,
  type SeriesRecord,
  type SeriesStatus,
  type SeriesType,
} from '../lib/library';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '../lib/posts';

interface CreateSeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (created: SeriesRecord) => void;
}

const MAX_TITLE_LENGTH = 120;
const MAX_SYNOPSIS_LENGTH = 1800;

export function CreateSeriesModal({
  isOpen,
  onClose,
  onCreated,
}: CreateSeriesModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<SeriesType>('novela');
  const [genre, setGenre] = useState<string>(SERIES_GENRES[0]);
  const [status, setStatus] = useState<SeriesStatus>('En emisión');
  const [synopsis, setSynopsis] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (coverPreview) {
        URL.revokeObjectURL(coverPreview);
      }
    };
  }, [coverPreview]);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
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
    setType('novela');
    setGenre(SERIES_GENRES[0]);
    setStatus('En emisión');
    setSynopsis('');
    clearCover();
    setErrorMsg(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setErrorMsg('Debes iniciar sesión para registrar una obra.');
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
      let coverUrl: string | null = null;
      if (coverFile) {
        coverUrl = await uploadSeriesCover(coverFile, user.id);
      }

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
      onCreated(created);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo registrar la obra. Inténtalo de nuevo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

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
      <div className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl border border-white/[0.1] bg-[#11151D] shadow-2xl sm:rounded-2xl">
        <div className="shrink-0 border-b border-white/[0.08] px-5 pt-3 pb-4 sm:px-6 sm:pt-5">
          <div
            aria-hidden="true"
            className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/[0.14] sm:hidden"
          />

          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                id="create-series-title"
                className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl"
              >
                Nueva Obra
              </h2>
              <p className="mt-0.5 text-xs text-[#8F99AB]">
                Registra una novela o un manhwa en el catálogo de Biblioteca.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Cerrar formulario"
              className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-[#97A1B2] hover:bg-white/[0.06] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
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
          {/* Tipo de obra */}
          <div>
            <span className="mb-2 block text-xs font-medium text-[#A9B3C4]">
              Formato
            </span>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-[#0B0E14] p-1">
              <button
                type="button"
                onClick={() => setType('novela')}
                className={`min-h-[42px] rounded-lg text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] ${
                  type === 'novela'
                    ? 'bg-[#1D2D46] text-[#9CC6FF]'
                    : 'text-[#8B95A5] hover:text-[#E2E7F0]'
                }`}
              >
                Novela
              </button>
              <button
                type="button"
                onClick={() => setType('manhwa')}
                className={`min-h-[42px] rounded-lg text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] ${
                  type === 'manhwa'
                    ? 'bg-[#3A2B14] text-[#FCD38D]'
                    : 'text-[#8B95A5] hover:text-[#E2E7F0]'
                }`}
              >
                Manhwa
              </button>
            </div>
          </div>

          {/* Título */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="series-title"
                className="block text-sm font-medium text-[#D5DCE6]"
              >
                Título
              </label>
              <span className="text-xs tabular-nums text-[#727C8F]">
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
              placeholder="Ej. Crónicas del Alba o Sombras de Seúl"
              className="min-h-[46px] w-full rounded-xl border border-white/[0.1] bg-[#0B0E14] px-3.5 text-sm text-white placeholder:text-[#667085] focus:border-[#388BFF] focus:outline-none focus:ring-2 focus:ring-[#388BFF]/30 transition-colors"
            />
          </div>

          {/* Género y Estado */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="series-genre"
                className="mb-1.5 block text-sm font-medium text-[#D5DCE6]"
              >
                Género
              </label>
              <select
                id="series-genre"
                value={genre}
                onChange={(event) => setGenre(event.target.value)}
                className="min-h-[46px] w-full rounded-xl border border-white/[0.1] bg-[#0B0E14] px-3.5 text-sm text-white focus:border-[#388BFF] focus:outline-none focus:ring-2 focus:ring-[#388BFF]/30 transition-colors"
              >
                {SERIES_GENRES.map((item) => (
                  <option key={item} value={item} className="bg-[#11151D]">
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-[#D5DCE6]">
                Estado
              </span>
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.1] bg-[#0B0E14] p-1">
                {SERIES_STATUSES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStatus(item)}
                    className={`min-h-[36px] rounded-lg px-2 text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] ${
                      status === item
                        ? 'bg-[#1D2432] text-white'
                        : 'text-[#8B95A5] hover:text-white'
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
                className="block text-sm font-medium text-[#D5DCE6]"
              >
                Sinopsis
              </label>
              <span className="text-xs tabular-nums text-[#727C8F]">
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
              className="w-full resize-y rounded-xl border border-white/[0.1] bg-[#0B0E14] px-3.5 py-3 text-sm leading-relaxed text-white placeholder:text-[#667085] focus:border-[#388BFF] focus:outline-none focus:ring-2 focus:ring-[#388BFF]/30 transition-colors"
            />
          </div>

          {/* Portada */}
          <div>
            <span className="mb-2 block text-sm font-medium text-[#D5DCE6]">
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

            {coverPreview ? (
              <div className="flex items-start gap-4 rounded-xl border border-white/[0.1] bg-[#0B0E14] p-3">
                <img
                  src={coverPreview}
                  alt="Vista previa de la portada"
                  className="aspect-[3/4] w-24 shrink-0 rounded-lg object-cover border border-white/[0.08]"
                />
                <div className="min-w-0 flex-1 space-y-2 pt-1">
                  <p className="text-xs font-medium text-[#DCE2EC] truncate">
                    {coverFile?.name}
                  </p>
                  <p className="text-xs text-[#7D8799]">
                    Lista para subirse al bucket media.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting}
                      className="min-h-[38px] rounded-lg border border-white/[0.12] px-3 text-xs font-medium text-[#DCE2EC] hover:bg-white/[0.06] transition-colors"
                    >
                      Cambiar
                    </button>
                    <button
                      type="button"
                      onClick={clearCover}
                      disabled={isSubmitting}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 px-3 text-xs font-medium text-red-300 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      <span>Quitar</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="min-h-[54px] w-full flex items-center justify-center gap-2.5 rounded-xl border border-dashed border-white/[0.15] bg-[#0B0E14]/70 px-4 py-3 text-sm font-medium text-[#A9B3C4] hover:border-white/[0.28] hover:bg-[#0F131B] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
              >
                <ImagePlus size={18} aria-hidden="true" />
                <span>Subir portada · JPG, PNG, WebP o GIF (máx. 5 MB)</span>
              </button>
            )}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200"
            >
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0 text-red-400"
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
              className="min-h-[46px] rounded-xl border border-white/[0.1] px-4 py-2.5 text-sm font-medium text-[#CBD5E1] hover:bg-white/[0.05] hover:text-white disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#388BFF] px-5 py-2.5 text-sm font-semibold text-[#06101F] hover:bg-[#529BFF] disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                  <span>Registrando…</span>
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
