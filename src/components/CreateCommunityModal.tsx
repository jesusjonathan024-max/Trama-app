import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Loader2, Plus, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  COMMUNITY_ICON_PRESETS,
  createCommunity,
  type CommunityRecord,
} from '../lib/phase4';

interface CreateCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (community: CommunityRecord) => void;
}

export function CreateCommunityModal({
  isOpen,
  onClose,
  onCreated,
}: CreateCommunityModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string>(COMMUNITY_ICON_PRESETS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setErrorMsg('Inicia sesión para crear una comunidad.');
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setErrorMsg('Escribe un nombre de al menos 2 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const created = await createCommunity({
        creatorId: user.id,
        name: trimmedName,
        description,
        icon,
      });
      setName('');
      setDescription('');
      setIcon(COMMUNITY_ICON_PRESETS[0]);
      onCreated(created);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo crear la comunidad.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-community-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl transition-colors duration-300 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Users size={18} aria-hidden="true" />
            </div>
            <div>
              <h2
                id="create-community-title"
                className="font-display text-lg font-bold text-[var(--text-main)]"
              >
                Nueva comunidad
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Crea un espacio temático para debates, recomendaciones y grupos.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <span className="mb-2 block text-xs font-semibold text-[var(--text-secondary)]">
              Ícono emoji
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {COMMUNITY_ICON_PRESETS.map((preset) => {
                const selected = icon === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setIcon(preset)}
                    aria-label={`Elegir emoji ${preset}`}
                    aria-pressed={selected}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition-colors ${
                      selected
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}

              <input
                type="text"
                maxLength={6}
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                aria-label="Emoji personalizado"
                placeholder="✨"
                className="h-10 w-14 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-center text-base text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="community-name-input"
              className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
            >
              Nombre de la comunidad
            </label>
            <input
              id="community-name-input"
              type="text"
              maxLength={60}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Gaming, Anime, Escritura, Tecnología…"
              className="min-h-[44px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25"
            />
          </div>

          <div>
            <label
              htmlFor="community-desc-input"
              className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
            >
              Descripción (opcional)
            </label>
            <textarea
              id="community-desc-input"
              rows={3}
              maxLength={240}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿De qué trata este grupo y qué tipo de publicaciones esperan?"
              className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25"
            />
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-200"
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  <span>Creando…</span>
                </>
              ) : (
                <>
                  <Plus size={16} aria-hidden="true" />
                  <span>Crear comunidad</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
