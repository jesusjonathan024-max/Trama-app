import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Code2,
  Eye,
  EyeOff,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  COMMUNITY_GAME_STARTER_TEMPLATE,
  MAX_COMMUNITY_GAME_BYTES,
  getUtf8ByteLength,
  submitCommunityGame,
  type CommunityGameRecord,
} from '../lib/phase4';
import { SandboxedGameFrame } from './SandboxedGameFrame';

interface SubmitCommunityGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: (game: CommunityGameRecord) => void;
}

export function SubmitCommunityGameModal({
  isOpen,
  onClose,
  onSubmitted,
}: SubmitCommunityGameModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [htmlCode, setHtmlCode] = useState('');
  const [showPreview, setShowPreview] = useState(false);
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

  const byteSize = getUtf8ByteLength(htmlCode);
  const kbSize = (byteSize / 1024).toFixed(1);
  const isOverLimit = byteSize > MAX_COMMUNITY_GAME_BYTES;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setErrorMsg('Debes iniciar sesión para enviar un juego.');
      return;
    }

    if (title.trim().length < 2) {
      setErrorMsg('Escribe un título de al menos 2 caracteres.');
      return;
    }
    if (!htmlCode.trim()) {
      setErrorMsg('Agrega el código HTML5/JS de tu minijuego.');
      return;
    }
    if (isOverLimit) {
      setErrorMsg(
        `Tu código pesa ${kbSize} KB y supera el máximo permitido de 50 KB.`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const created = await submitCommunityGame({
        authorId: user.id,
        title,
        description,
        htmlCode,
      });
      setTitle('');
      setDescription('');
      setHtmlCode('');
      setShowPreview(false);
      onSubmitted(created);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo enviar tu juego para revisión.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-community-game-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-sm overflow-y-auto"
    >
      <div className="my-auto flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl transition-colors duration-300">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Code2 size={18} aria-hidden="true" />
            </div>
            <div>
              <h2
                id="submit-community-game-heading"
                className="font-display text-lg font-bold text-[var(--text-main)]"
              >
                Enviar minijuego HTML5 a la comunidad
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Quedará en revisión del Dueño antes de publicarse en Arcade.
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

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto space-y-4 p-5"
        >
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-200">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              Todos los juegos de la comunidad se ejecutan en un entorno <strong>Sandbox aislado</strong> (sin acceso a cuentas ni datos de Trama). Envía un solo archivo HTML autocontenido con tu CSS y JavaScript (máx. 50 KB).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="community-game-title"
                className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
              >
                Título del juego
              </label>
              <input
                id="community-game-title"
                type="text"
                maxLength={80}
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Cazador de Meteoros"
                className="min-h-[42px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25"
              />
            </div>

            <div>
              <label
                htmlFor="community-game-desc"
                className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
              >
                Descripción breve y controles
              </label>
              <input
                id="community-game-desc"
                type="text"
                maxLength={320}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Usa flechas o toca la pantalla para recolectar orbes."
                className="min-h-[42px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="community-game-code"
                className="text-xs font-semibold text-[var(--text-secondary)]"
              >
                Código HTML5 / Canvas autocontenido
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHtmlCode(COMMUNITY_GAME_STARTER_TEMPLATE);
                    if (!title.trim()) setTitle('Recolector de Orbes');
                    if (!description.trim()) {
                      setDescription(
                        'Mueve el núcleo azul con WASD/flechas o arrastrando el dedo para atrapar los orbes dorados.'
                      );
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-soft)] transition-colors"
                >
                  <Sparkles size={12} aria-hidden="true" />
                  <span>Cargar plantilla Canvas</span>
                </button>

                {htmlCode.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPreview((p) => !p)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    {showPreview ? (
                      <>
                        <EyeOff size={12} aria-hidden="true" />
                        <span>Ocultar prueba</span>
                      </>
                    ) : (
                      <>
                        <Eye size={12} aria-hidden="true" />
                        <span>Probar en Sandbox</span>
                      </>
                    )}
                  </button>
                )}

                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    isOverLimit ? 'text-red-500' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {kbSize} / 50.0 KB
                </span>
              </div>
            </div>

            <textarea
              id="community-game-code"
              rows={9}
              required
              spellCheck={false}
              value={htmlCode}
              onChange={(e) => setHtmlCode(e.target.value)}
              placeholder="<!DOCTYPE html><html>...</html>"
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3.5 font-mono text-xs leading-relaxed text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25"
            />
          </div>

          {showPreview && htmlCode.trim() && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                Vista previa en vivo (Sandbox)
              </p>
              <SandboxedGameFrame
                title={`Vista previa: ${title || 'Minijuego'}`}
                htmlCode={htmlCode}
                className="h-[340px] w-full"
              />
            </div>
          )}

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
              disabled={isSubmitting || isOverLimit}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  <span>Enviando…</span>
                </>
              ) : (
                <>
                  <Send size={15} aria-hidden="true" />
                  <span>Enviar para aprobación</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
