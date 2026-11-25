import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Code2,
  Eye,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import {
  deleteCommunityGame,
  fetchAllCommunityGamesForOwner,
  formatCommunityGameStatus,
  getUtf8ByteLength,
  moderateCommunityGame,
  type CommunityGameRecord,
} from '../lib/phase4';
import { formatRelativeDate, getAuthorDisplayName } from '../lib/posts';
import { SandboxedGameFrame } from './SandboxedGameFrame';

export function OwnerGameModerationPanel() {
  const [games, setGames] = useState<CommunityGameRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [busyGameId, setBusyGameId] = useState<string | null>(null);
  const [previewGame, setPreviewGame] = useState<CommunityGameRecord | null>(
    null
  );

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const list = await fetchAllCommunityGamesForOwner();
      setGames(list);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los juegos enviados por la comunidad.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!previewGame) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setPreviewGame(null);
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [previewGame]);

  async function handleModerate(
    gameId: string,
    nextStatus: 'approved' | 'rejected'
  ) {
    if (busyGameId) return;
    setBusyGameId(gameId);
    setErrorMsg(null);
    try {
      const saved = await moderateCommunityGame(gameId, nextStatus);
      setGames((prev) =>
        prev.map((g) => (g.id === gameId ? { ...g, status: saved } : g))
      );
      if (previewGame?.id === gameId) {
        setPreviewGame((prev) => (prev ? { ...prev, status: saved } : null));
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar el estado del juego.'
      );
    } finally {
      setBusyGameId(null);
    }
  }

  async function handleDelete(gameId: string) {
    if (busyGameId) return;
    setBusyGameId(gameId);
    setErrorMsg(null);
    try {
      await deleteCommunityGame(gameId);
      setGames((prev) => prev.filter((g) => g.id !== gameId));
      if (previewGame?.id === gameId) setPreviewGame(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo eliminar el juego.'
      );
    } finally {
      setBusyGameId(null);
    }
  }

  const pendingCount = games.filter((g) => g.status === 'pending').length;
  const visibleGames =
    filter === 'pending' ? games.filter((g) => g.status === 'pending') : games;

  return (
    <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Code2
            size={17}
            className="text-amber-600 dark:text-amber-300 shrink-0"
            aria-hidden="true"
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-bold text-[var(--text-main)]">
                Moderación de Juegos
              </h3>
              {pendingCount > 0 && (
                <span className="rounded-md border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-300 tabular-nums">
                  {pendingCount}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Previsualiza en Sandbox aislado y aprueba o rechaza juegos HTML5 enviados por la comunidad.
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === 'pending'
                ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
            }`}
          >
            Pendientes ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
            }`}
          >
            Todos ({games.length})
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-200"
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="mt-4 max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
        {isLoading && games.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--text-muted)]">
            <Loader2 size={15} className="animate-spin text-[var(--accent-primary)]" aria-hidden="true" />
            <span>Cargando juegos enviados…</span>
          </div>
        ) : visibleGames.length === 0 ? (
          <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-6 text-center text-xs text-[var(--text-muted)]">
            {filter === 'pending'
              ? 'No hay juegos pendientes de moderación.'
              : 'Todavía no se han enviado juegos de la comunidad.'}
          </p>
        ) : (
          visibleGames.map((game) => {
            const isBusy = busyGameId === game.id;
            const authorName = getAuthorDisplayName(game.author);
            const kb = (getUtf8ByteLength(game.html_code) / 1024).toFixed(1);

            return (
              <div
                key={game.id}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3.5 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                        game.status === 'approved'
                          ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300'
                          : game.status === 'rejected'
                            ? 'border-red-500/35 bg-red-500/12 text-red-600 dark:text-red-300'
                            : 'border-amber-500/35 bg-amber-500/12 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {formatCommunityGameStatus(game.status)}
                    </span>
                    <span className="truncate font-bold text-[var(--text-main)]">
                      {game.title}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      por {authorName} · {kb} KB
                    </span>
                  </div>

                  <time
                    dateTime={game.created_at}
                    className="text-[11px] text-[var(--text-muted)] tabular-nums"
                  >
                    {formatRelativeDate(game.created_at)}
                  </time>
                </div>

                {game.description && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    {game.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPreviewGame(game)}
                    className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-border)] hover:text-[var(--accent-primary)] transition-colors"
                  >
                    <Eye size={13} aria-hidden="true" />
                    <span>Previsualizar</span>
                  </button>

                  {game.status !== 'approved' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleModerate(game.id, 'approved')}
                      className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                    >
                      <Check size={13} aria-hidden="true" />
                      <span>Aprobar</span>
                    </button>
                  )}

                  {game.status !== 'rejected' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleModerate(game.id, 'rejected')}
                      className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-red-500/35 bg-red-500/10 px-3 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                    >
                      <X size={13} aria-hidden="true" />
                      <span>Rechazar</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleDelete(game.id)}
                    title="Eliminar envío"
                    aria-label={`Eliminar ${game.title}`}
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-red-500/35 hover:text-red-500 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de previsualización en Sandbox estricto para moderación del Dueño */}
      {previewGame && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-preview-game-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-sm"
        >
          <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <h4
                  id="owner-preview-game-title"
                  className="truncate font-display text-lg font-bold text-[var(--text-main)]"
                >
                  Revisión Sandbox: {previewGame.title}
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Enviado por {getAuthorDisplayName(previewGame.author)} · Estado:{' '}
                  {formatCommunityGameStatus(previewGame.status)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {previewGame.status !== 'approved' && (
                  <button
                    type="button"
                    disabled={busyGameId === previewGame.id}
                    onClick={() =>
                      void handleModerate(previewGame.id, 'approved')
                    }
                    className="min-h-[36px] inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                  >
                    <Check size={14} aria-hidden="true" />
                    <span>Aprobar</span>
                  </button>
                )}
                {previewGame.status !== 'rejected' && (
                  <button
                    type="button"
                    disabled={busyGameId === previewGame.id}
                    onClick={() =>
                      void handleModerate(previewGame.id, 'rejected')
                    }
                    className="min-h-[36px] inline-flex items-center gap-1 rounded-xl bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                  >
                    <X size={14} aria-hidden="true" />
                    <span>Rechazar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewGame(null)}
                  aria-label="Cerrar previsualización"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              <SandboxedGameFrame
                title={`Vista previa de moderación: ${previewGame.title}`}
                htmlCode={previewGame.html_code}
                className="h-[64dvh] max-h-[540px] w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
