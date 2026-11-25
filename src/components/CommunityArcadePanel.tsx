import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Code2,
  Gamepad2,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchApprovedCommunityGames,
  fetchMyCommunityGames,
  formatCommunityGameStatus,
  type CommunityGameRecord,
} from '../lib/phase4';
import { formatRelativeDate, getAuthorDisplayName } from '../lib/posts';
import { Avatar } from './Avatar';
import { OwnerBadge } from './OwnerBadge';
import { SandboxedGameFrame } from './SandboxedGameFrame';
import { SubmitCommunityGameModal } from './SubmitCommunityGameModal';

interface CommunityArcadePanelProps {
  onOpenAuth: () => void;
}

export function CommunityArcadePanel({
  onOpenAuth,
}: CommunityArcadePanelProps) {
  const { user, isAuthenticated } = useAuth();
  const [approvedGames, setApprovedGames] = useState<CommunityGameRecord[]>([]);
  const [myGames, setMyGames] = useState<CommunityGameRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [playingGame, setPlayingGame] = useState<CommunityGameRecord | null>(
    null
  );
  const [submitBanner, setSubmitBanner] = useState<string | null>(null);

  const loadGames = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [approved, mine] = await Promise.all([
        fetchApprovedCommunityGames(),
        user?.id ? fetchMyCommunityGames(user.id).catch(() => []) : Promise.resolve([]),
      ]);
      setApprovedGames(approved);
      setMyGames(mine);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los juegos de la comunidad.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadGames();
  }, [loadGames]);

  // Escape para cerrar el jugador modal Sandbox
  useEffect(() => {
    if (!playingGame) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setPlayingGame(null);
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [playingGame]);

  const myPendingOrRejected = myGames.filter((g) => g.status !== 'approved');

  return (
    <div className="mt-7 space-y-6">
      {/* Cabecera de Arcade de la Comunidad */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:flex-row sm:items-center sm:justify-between shadow-sm transition-colors duration-300">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <Code2 size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-[var(--text-main)]">
              Arcade de la Comunidad
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Minijuegos HTML5/Canvas creados por miembros de Trama y ejecutados en aislamiento Sandbox seguro.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadGames()}
            disabled={isLoading}
            aria-label="Actualizar juegos de la comunidad"
            className="min-h-[42px] inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              size={14}
              className={isLoading ? 'animate-spin' : ''}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                onOpenAuth();
                return;
              }
              setSubmitBanner(null);
              setIsSubmitModalOpen(true);
            }}
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 text-xs font-bold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <Plus size={15} aria-hidden="true" />
            <span>Enviar Juego</span>
          </button>
        </div>
      </div>

      {submitBanner && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-700 dark:text-emerald-200">
          <span>{submitBanner}</span>
          <button
            type="button"
            onClick={() => setSubmitBanner(null)}
            aria-label="Cerrar mensaje"
            className="rounded-lg p-1 hover:bg-emerald-500/15"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-xs text-red-700 dark:text-red-200"
        >
          <AlertCircle size={15} className="shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Catálogo de juegos aprobados */}
      {isLoading && approvedGames.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="h-44 animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]" />
          <div className="h-44 animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]" />
        </div>
      ) : approvedGames.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-12 text-center shadow-sm">
          <Gamepad2
            size={28}
            className="mx-auto text-[var(--accent-primary)]"
            aria-hidden="true"
          />
          <h3 className="mt-3 font-display text-lg font-bold text-[var(--text-main)]">
            Aún no hay juegos aprobados de la comunidad
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs text-[var(--text-secondary)]">
            ¡Sé el primero en enviar tu minijuego HTML5/Canvas! Una vez que el Dueño lo revise y apruebe aparecerá aquí para todos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {approvedGames.map((game) => {
            const authorName = getAuthorDisplayName(game.author);
            return (
              <article
                key={game.id}
                className="flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-sm hover:border-[var(--accent-border)] transition-colors duration-300"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        src={game.author.avatar_url}
                        name={authorName}
                        size="sm"
                      />
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate font-semibold text-[var(--text-main)]">
                          {authorName}
                        </span>
                        <OwnerBadge
                          role={game.author.role}
                          badge={game.author.badge}
                          size="xs"
                        />
                      </div>
                    </div>

                    <span className="shrink-0 text-[11px] text-[var(--text-muted)] tabular-nums">
                      {formatRelativeDate(game.created_at)}
                    </span>
                  </div>

                  <h3 className="mt-3 font-display text-xl font-bold text-[var(--text-main)]">
                    {game.title}
                  </h3>

                  {game.description ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-3">
                      {game.description}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                      Minijuego HTML5 autocontenido creado por la comunidad.
                    </p>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck size={13} aria-hidden="true" />
                    <span>Sandbox verificado</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setPlayingGame(game)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 text-xs font-bold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all"
                  >
                    <Play size={14} className="fill-current" aria-hidden="true" />
                    <span>Jugar</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Mis envíos en revisión o rechazados */}
      {isAuthenticated && myPendingOrRejected.length > 0 && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-sm">
          <h3 className="font-display text-sm font-bold text-[var(--text-main)]">
            Tus envíos recientes ({myPendingOrRejected.length})
          </h3>
          <div className="mt-3 space-y-2">
            {myPendingOrRejected.map((game) => (
              <div
                key={game.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--text-main)]">
                    {game.title}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                    Enviado {formatRelativeDate(game.created_at)}
                  </p>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    game.status === 'rejected'
                      ? 'bg-red-500/15 text-red-600 dark:text-red-300'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {formatCommunityGameStatus(game.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de envío de minijuego */}
      <SubmitCommunityGameModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSubmitted={(created) => {
          setMyGames((prev) => [created, ...prev]);
          setSubmitBanner(
            `¡“${created.title}” fue enviado! Quedará disponible en Arcade de la Comunidad en cuanto el Dueño lo apruebe.`
          );
        }}
      />

      {/* Reproductor Modal Sandbox aislado */}
      {playingGame && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sandbox-player-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-sm"
        >
          <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <h2
                  id="sandbox-player-title"
                  className="truncate font-display text-lg font-bold text-[var(--text-main)]"
                >
                  {playingGame.title}
                </h2>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  Creado por {getAuthorDisplayName(playingGame.author)}
                  {playingGame.description ? ` · ${playingGame.description}` : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPlayingGame(null)}
                aria-label="Cerrar juego"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="p-3 sm:p-4">
              <SandboxedGameFrame
                title={playingGame.title}
                htmlCode={playingGame.html_code}
                className="h-[68dvh] max-h-[580px] w-full"
              />
            </div>
          </div>
        </div>
      )}

      {isLoading && approvedGames.length > 0 && (
        <div className="sr-only">
          <Loader2 />
        </div>
      )}
    </div>
  );
}
