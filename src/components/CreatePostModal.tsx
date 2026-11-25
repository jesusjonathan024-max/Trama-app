import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  AlertCircle,
  BarChart3,
  ImagePlus,
  Link2,
  Loader2,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useAchievements } from '../context/AchievementContext';
import { useAuth } from '../context/AuthContext';
import {
  POLL_DURATION_OPTIONS,
  createPostPoll,
  type PollDurationOption,
} from '../lib/phase3';
import { fetchCommunities, type CommunityRecord } from '../lib/phase4';
import {
  ACTUALIDAD_CATEGORIES,
  ALLOWED_IMAGE_TYPES,
  COMUNIDAD_CATEGORIES,
  MAX_IMAGE_SIZE_BYTES,
  createPost,
  uploadPostImage,
  type PostMode,
} from '../lib/posts';
import { isStrictHttpsUrl } from '../lib/supabase';

interface CreatePostModalProps {
  isOpen: boolean;
  defaultMode: PostMode;
  defaultCommunityId?: string | null;
  onClose: () => void;
  onCreated: (mode: PostMode) => void;
}

const MAX_TITLE_LENGTH = 160;
const MAX_CONTENT_LENGTH = 12000;

export function CreatePostModal({
  isOpen,
  defaultMode,
  defaultCommunityId = null,
  onClose,
  onCreated,
}: CreatePostModalProps) {
  const { user } = useAuth();
  const { unlockByKeys } = useAchievements();
  const [mode, setMode] = useState<PostMode>(defaultMode);
  const [category, setCategory] = useState<string>(ACTUALIDAD_CATEGORIES[0]);
  const [communities, setCommunities] = useState<CommunityRecord[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>(
    defaultCommunityId ?? ''
  );
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [includePoll, setIncludePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollDuration, setPollDuration] = useState<PollDurationOption>('3d');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMode(defaultMode);
    setCategory(
      defaultMode === 'actualidad'
        ? ACTUALIDAD_CATEGORIES[0]
        : COMUNIDAD_CATEGORIES[0]
    );
    setSelectedCommunityId(defaultCommunityId ?? '');
    setErrorMsg(null);
    fetchCommunities(user?.id)
      .then((list) => setCommunities(list))
      .catch(() => {
        // Ignora fallo auxiliar
      });
  }, [isOpen, defaultMode, defaultCommunityId, user?.id]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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

  const categories =
    mode === 'actualidad' ? ACTUALIDAD_CATEGORIES : COMUNIDAD_CATEGORIES;

  function handleSwitchMode(nextMode: PostMode) {
    setMode(nextMode);
    setCategory(
      nextMode === 'actualidad'
        ? ACTUALIDAD_CATEGORIES[0]
        : COMUNIDAD_CATEGORIES[0]
    );
    setErrorMsg(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setErrorMsg(null);

    if (!ALLOWED_IMAGE_TYPES[file.type]) {
      setErrorMsg('Formato no permitido. Usa una imagen JPG, PNG, WebP o GIF.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setErrorMsg('La imagen supera el límite de 5 MB.');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearSelectedImage() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
  }

  function resetForm() {
    setTitle('');
    setContent('');
    setSourceName('');
    setSourceUrl('');
    setSelectedCommunityId('');
    setIncludePoll(false);
    setPollQuestion('');
    setPollOptions(['', '']);
    setPollDuration('3d');
    clearSelectedImage();
    setErrorMsg(null);
  }

  function handlePollOptionChange(index: number, value: string) {
    setPollOptions((prev) =>
      prev.map((item, idx) => (idx === index ? value : item))
    );
  }

  function handleAddPollOption() {
    if (pollOptions.length >= 4) return;
    setPollOptions((prev) => [...prev, '']);
  }

  function handleRemovePollOption(index: number) {
    if (pollOptions.length <= 2) return;
    setPollOptions((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setErrorMsg('Debes iniciar sesión para publicar.');
      return;
    }

    setErrorMsg(null);
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const trimmedSourceName = sourceName.trim();
    const trimmedSourceUrl = sourceUrl.trim();

    if (mode === 'actualidad' && !trimmedTitle) {
      setErrorMsg('El título es obligatorio para publicar en Actualidad.');
      return;
    }

    if (!trimmedContent) {
      setErrorMsg(
        mode === 'actualidad'
          ? 'Escribe el texto del artículo antes de publicar.'
          : 'Escribe el texto del hilo antes de publicar.'
      );
      return;
    }

    if (
      mode === 'actualidad' &&
      trimmedSourceUrl &&
      !isStrictHttpsUrl(trimmedSourceUrl)
    ) {
      setErrorMsg(
        'El enlace de referencia debe ser una URL válida que empiece con https://'
      );
      return;
    }

    const cleanedPollOptions = pollOptions
      .map((opt) => opt.trim())
      .filter((opt) => opt.length > 0);

    if (mode === 'comunidad' && includePoll) {
      if (!pollQuestion.trim()) {
        setErrorMsg('Escribe la pregunta de tu encuesta antes de publicar.');
        return;
      }
      if (cleanedPollOptions.length < 2) {
        setErrorMsg('La encuesta debe tener al menos 2 opciones de respuesta.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let uploadedImageUrl: string | null = null;
      if (selectedFile) {
        uploadedImageUrl = await uploadPostImage(selectedFile, user.id);
      }

      const createdPostId = await createPost({
        authorId: user.id,
        mode,
        category,
        title: trimmedTitle || null,
        content: trimmedContent,
        imageUrl: uploadedImageUrl,
        sourceName: mode === 'actualidad' ? trimmedSourceName || null : null,
        sourceUrl: mode === 'actualidad' ? trimmedSourceUrl || null : null,
        communityId:
          mode === 'comunidad' && selectedCommunityId
            ? selectedCommunityId
            : null,
      });

      if (mode === 'comunidad' && includePoll) {
        await createPostPoll({
          postId: createdPostId,
          question: pollQuestion.trim(),
          options: cleanedPollOptions,
          duration: pollDuration,
        });
      }

      void unlockByKeys(['first_post']);

      const publishedMode = mode;
      resetForm();
      onClose();
      onCreated(publishedMode);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar la publicación. Inténtalo nuevamente.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-post-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl transition-colors duration-300 sm:rounded-2xl">
        {/* Cabecera fija del modal */}
        <div className="shrink-0 border-b border-[var(--border-subtle)] px-5 pt-3 pb-4 sm:px-6 sm:pt-5">
          <div
            aria-hidden="true"
            className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden"
          />

          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                id="create-post-title"
                className="font-display text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl"
              >
                Nueva publicación
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Elige el modo y comparte tu artículo o hilo en Trama.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Cerrar formulario de publicación"
              className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Cuerpo deslizable del formulario */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5"
          noValidate
        >
          {/* Paso 1: Selector de Modo */}
          <div>
            <span className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
              Modo de publicación
            </span>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1">
              <button
                type="button"
                onClick={() => handleSwitchMode('actualidad')}
                className={`min-h-[42px] rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  mode === 'actualidad'
                    ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                Actualidad
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode('comunidad')}
                className={`min-h-[42px] rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  mode === 'comunidad'
                    ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                Comunidad
              </button>
            </div>
          </div>

          {/* Categoría */}
          <div>
            <label
              htmlFor="post-category"
              className="mb-2 block text-sm font-medium text-[var(--text-main)]"
            >
              Categoría
            </label>
            <div
              id="post-category"
              role="radiogroup"
              aria-label="Seleccionar categoría"
              className="flex flex-wrap gap-2"
            >
              {categories.map((item) => {
                const isSelected = category === item;
                return (
                  <button
                    key={item}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setCategory(item)}
                    className={`min-h-[40px] rounded-xl border px-3.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                      isSelected
                        ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comunidad / Grupo opcional (solo en modo Comunidad) */}
          {mode === 'comunidad' && communities.length > 0 && (
            <div>
              <label
                htmlFor="post-community-select"
                className="mb-1.5 block text-sm font-medium text-[var(--text-main)]"
              >
                Comunidad / Grupo (opcional)
              </label>
              <select
                id="post-community-select"
                value={selectedCommunityId}
                onChange={(e) => setSelectedCommunityId(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 text-sm text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25 transition-colors"
              >
                <option value="">Comunidad general (sin grupo específico)</option>
                {communities.map((comm) => (
                  <option key={comm.id} value={comm.id}>
                    {comm.icon} {comm.name} ({comm.members_count}{' '}
                    {comm.members_count === 1 ? 'miembro' : 'miembros'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Título (obligatorio en Actualidad, opcional en Comunidad) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="post-title"
                className="block text-sm font-medium text-[var(--text-main)]"
              >
                {mode === 'actualidad'
                  ? 'Título del artículo'
                  : 'Título (opcional)'}
              </label>
              <span className="text-xs tabular-nums text-[var(--text-muted)]">
                {title.length} / {MAX_TITLE_LENGTH}
              </span>
            </div>
            <input
              id="post-title"
              type="text"
              required={mode === 'actualidad'}
              maxLength={MAX_TITLE_LENGTH}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                mode === 'actualidad'
                  ? 'Un titular claro y preciso para tu artículo'
                  : 'Añade un título breve si quieres destacar el tema'
              }
              className="min-h-[46px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 transition-colors"
            />
          </div>

          {/* Cuerpo del artículo o hilo */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="post-content"
                className="block text-sm font-medium text-[var(--text-main)]"
              >
                {mode === 'actualidad'
                  ? 'Texto del artículo'
                  : 'Texto del hilo'}
              </label>
              <span className="text-xs tabular-nums text-[var(--text-muted)]">
                {content.length} / {MAX_CONTENT_LENGTH}
              </span>
            </div>
            <textarea
              id="post-content"
              rows={mode === 'actualidad' ? 7 : 5}
              required
              maxLength={MAX_CONTENT_LENGTH}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={
                mode === 'actualidad'
                  ? 'Desarrolla tu noticia, crónica o análisis con párrafos separados…'
                  : '¿Qué quieres debatir o compartir hoy con la comunidad?'
              }
              className="w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-3 text-sm leading-relaxed text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 transition-colors"
            />
          </div>

          {/* Fuentes de referencia editorial (solo en Actualidad) */}
          {mode === 'actualidad' && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-main)]">
                <Link2
                  size={15}
                  className="text-[var(--accent-primary)]"
                  aria-hidden="true"
                />
                <span>Fuente de referencia (opcional)</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="post-source-name"
                    className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
                  >
                    Nombre de la fuente
                  </label>
                  <input
                    id="post-source-name"
                    type="text"
                    maxLength={120}
                    value={sourceName}
                    onChange={(event) => setSourceName(event.target.value)}
                    placeholder="Ej. Reuters, BBC Mundo, El País"
                    className="min-h-[42px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25 transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="post-source-url"
                    className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
                  >
                    Enlace de referencia (https://)
                  </label>
                  <input
                    id="post-source-url"
                    type="url"
                    maxLength={500}
                    value={sourceUrl}
                    onChange={(event) => setSourceUrl(event.target.value)}
                    placeholder="https://ejemplo.com/articulo"
                    className="min-h-[42px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Encuesta interactiva opcional (solo en Comunidad) */}
          {mode === 'comunidad' && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4 space-y-3.5 transition-colors duration-300">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-main)]">
                  <BarChart3
                    size={15}
                    className="text-[var(--accent-primary)]"
                    aria-hidden="true"
                  />
                  <span>Agregar encuesta</span>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={includePoll}
                  onClick={() => setIncludePoll((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                    includePoll
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-card)]'
                  }`}
                >
                  <span className="sr-only">Activar encuesta</span>
                  <span
                    aria-hidden="true"
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-200 ${
                      includePoll ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {includePoll && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label
                      htmlFor="poll-question-input"
                      className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
                    >
                      Pregunta de la encuesta
                    </label>
                    <input
                      id="poll-question-input"
                      type="text"
                      maxLength={180}
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="Ej. ¿Qué arco del manga te gustó más?"
                      className="min-h-[42px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        Opciones (2 a 4)
                      </span>
                      {pollOptions.length < 4 && (
                        <button
                          type="button"
                          onClick={handleAddPollOption}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-soft)] transition-colors"
                        >
                          <Plus size={13} aria-hidden="true" />
                          <span>Agregar opción</span>
                        </button>
                      )}
                    </div>

                    {pollOptions.map((optionValue, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={90}
                          value={optionValue}
                          onChange={(e) =>
                            handlePollOptionChange(idx, e.target.value)
                          }
                          placeholder={`Opción ${idx + 1}`}
                          aria-label={`Opción ${idx + 1} de la encuesta`}
                          className="min-h-[40px] flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25 transition-colors"
                        />
                        {pollOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePollOption(idx)}
                            aria-label={`Quitar opción ${idx + 1}`}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-red-500/35 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                      Duración de la encuesta
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {POLL_DURATION_OPTIONS.map((opt) => {
                        const active = pollDuration === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setPollDuration(opt.value)}
                            className={`min-h-[38px] rounded-xl border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                              active
                                ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Imagen opcional */}
          <div>
            <span className="mb-2 block text-sm font-medium text-[var(--text-main)]">
              Imagen (opcional)
            </span>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              className="sr-only"
              aria-label="Seleccionar imagen para la publicación"
            />

            {previewUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
                <img
                  src={previewUrl}
                  alt="Vista previa de la imagen seleccionada"
                  className="max-h-56 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={clearSelectedImage}
                  disabled={isSubmitting}
                  aria-label="Quitar imagen"
                  className="absolute right-2.5 top-2.5 min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-black/75 px-3 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/90 transition-colors"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  <span>Quitar</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="min-h-[52px] w-full flex items-center justify-center gap-2.5 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              >
                <ImagePlus size={18} aria-hidden="true" />
                <span>Adjuntar imagen · JPG, PNG, WebP o GIF (máx. 5 MB)</span>
              </button>
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

          {/* Pie de acciones */}
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
                  <span>Publicando…</span>
                </>
              ) : (
                <>
                  <Send size={16} aria-hidden="true" />
                  <span>
                    {mode === 'actualidad'
                      ? 'Publicar artículo'
                      : 'Publicar hilo'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
