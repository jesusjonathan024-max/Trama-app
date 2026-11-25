import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Loader2, Save, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  ACTUALIDAD_CATEGORIES,
  COMUNIDAD_CATEGORIES,
  updatePost,
  type PostRecord,
} from '../lib/posts';

interface EditPostModalProps {
  post: PostRecord | null;
  onClose: () => void;
  onSaved: (updated: PostRecord) => void;
}

const MAX_TITLE_LENGTH = 160;
const MAX_CONTENT_LENGTH = 12000;

export function EditPostModal({
  post,
  onClose,
  onSaved,
}: EditPostModalProps) {
  const { user, isOwner } = useAuth();
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!post) return;
    setCategory(post.category);
    setTitle(post.title ?? '');
    setContent(post.content);
    setErrorMsg(null);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [post, isSaving, onClose]);

  if (!post) return null;

  const isActualidad = post.mode === 'actualidad';
  const categories = isActualidad ? ACTUALIDAD_CATEGORIES : COMUNIDAD_CATEGORIES;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!post || !user) return;
    if (!isOwner && user.id !== post.author_id) {
      setErrorMsg('No tienes permiso para editar esta publicación.');
      return;
    }

    setErrorMsg(null);
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (isActualidad && !trimmedTitle) {
      setErrorMsg('El título es obligatorio para los artículos de Actualidad.');
      return;
    }

    if (!trimmedContent) {
      setErrorMsg('El contenido de la publicación no puede quedar vacío.');
      return;
    }

    setIsSaving(true);
    try {
      await updatePost({
        postId: post.id,
        userId: user.id,
        isOwner,
        category,
        title: trimmedTitle || null,
        content: trimmedContent,
      });

      onSaved({
        ...post,
        category,
        title: trimmedTitle || null,
        content: trimmedContent,
      });
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudieron guardar los cambios.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-post-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
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
                id="edit-post-title"
                className="font-display text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl"
              >
                Editar {isActualidad ? 'artículo' : 'hilo'}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Modifica la categoría, el título o el texto de esta publicación.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              aria-label="Cerrar editor"
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
          <div>
            <span className="mb-2 block text-sm font-medium text-[var(--text-main)]">
              Categoría
            </span>
            <div className="flex flex-wrap gap-2">
              {categories.map((item) => {
                const isSelected = category === item;
                return (
                  <button
                    key={item}
                    type="button"
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

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="edit-post-title-input"
                className="block text-sm font-medium text-[var(--text-main)]"
              >
                {isActualidad ? 'Título del artículo' : 'Título (opcional)'}
              </label>
              <span className="text-xs tabular-nums text-[var(--text-muted)]">
                {title.length} / {MAX_TITLE_LENGTH}
              </span>
            </div>
            <input
              id="edit-post-title-input"
              type="text"
              required={isActualidad}
              maxLength={MAX_TITLE_LENGTH}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="min-h-[46px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 transition-colors"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="edit-post-content-input"
                className="block text-sm font-medium text-[var(--text-main)]"
              >
                {isActualidad ? 'Texto del artículo' : 'Texto del hilo'}
              </label>
              <span className="text-xs tabular-nums text-[var(--text-muted)]">
                {content.length} / {MAX_CONTENT_LENGTH}
              </span>
            </div>
            <textarea
              id="edit-post-content-input"
              rows={isActualidad ? 8 : 5}
              required
              maxLength={MAX_CONTENT_LENGTH}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-3 text-sm leading-relaxed text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 transition-colors"
            />
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-500/12 px-3.5 py-3 text-sm text-red-700 dark:text-red-100"
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
              disabled={isSaving}
              className="min-h-[46px] rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  <span>Guardando…</span>
                </>
              ) : (
                <>
                  <Save size={16} aria-hidden="true" />
                  <span>Guardar cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
