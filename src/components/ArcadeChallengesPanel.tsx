import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Crown,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  DUEL_SUPPORTED_GAMES,
  fetchRegisteredUsersDirectory,
  getDuelGameTitle,
  type ArcadeChallengeRecord,
  type DuelGameId,
} from '../lib/phase4';
import {
  formatRelativeDate,
  getAuthorDisplayName,
  type PostAuthor,
} from '../lib/posts';
import { Avatar } from './Avatar';
import { OwnerBadge } from './OwnerBadge';

interface ArcadeChallengesPanelProps {
  challenges: ArcadeChallengeRecord[];
  isLoading: boolean;
  errorMsg: string | null;
  onRefresh: () => void;
  onOpenAuth: () => void;
  onLaunchCreateDuel: (gameId: DuelGameId, opponent: PostAuthor) => void;
  onLaunchAcceptDuel: (challenge: ArcadeChallengeRecord) => void;
}

export function ArcadeChallengesPanel({
  challenges,
  isLoading,
  errorMsg,
  onRefresh,
  onOpenAuth,
  onLaunchCreateDuel,
  onLaunchAcceptDuel,
}: ArcadeChallengesPanelProps) {
  const { user, isAuthenticated } = useAuth();

  const [selectedGameId, setSelectedGameId] =
    useState<DuelGameId>('senda-astral');
  const [opponentQuery, setOpponentQuery] = useState('');
  const [directory, setDirectory] = useState<PostAuthor[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState<PostAuthor | null>(
    null
  );
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setDirectory([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setIsLoadingUsers(true);
      try {
        const users = await fetchRegisteredUsersDirectory(
          user.id,
          opponentQuery
        );
        if (active) setDirectory(users);
      } catch {
        if (active) setDirectory([]);
      } finally {
        if (active) setIsLoadingUsers(false);
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [user?.id, opponentQuery]);

  const incomingPending = useMemo(
    () =>
      challenges.filter(
        (c) =>
          user?.id &&
          c.challenged_id === user.id &&
          c.status.toLowerCase() !== 'completed'
      ),
    [challenges, user?.id]
  );

  const outgoingPending = useMemo(
    () =>
      challenges.filter(
        (c) =>
          user?.id &&
          c.challenger_id === user.id &&
          c.status.toLowerCase() !== 'completed'
      ),
    [challenges, user?.id]
  );

  const completedDuels = useMemo(
    () =>
      challenges.filter((c) => c.status.toLowerCase() === 'completed'),
    [challenges]
  );

  if (!isAuthenticated || !user) {
    return (
      <div className="mt-7 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-12 text-center shadow-sm transition-colors duration-300">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
          <Swords size={22} aria-hidden="true" />
        </div>
        <h2 className="mt-3 font-display text-xl font-bold text-[var(--text-main)]">
          Retos 1v1 entre Amigos
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--text-secondary)]">
          Inicia sesión para desafiar a otros jugadores de Trama en Senda Astral o Bastión de Runas y aceptar duelos pendientes.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="mt-5 min-h-[44px] rounded-xl bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] transition-colors"
        >
          Iniciar sesión para retar
        </button>
      </div>
    );
  }

  function handleStartDuel() {
    setFormError(null);
    if (!selectedOpponent) {
      setFormError('Selecciona primero a un jugador de la lista para retarlo.');
      return;
    }
    onLaunchCreateDuel(selectedGameId, selectedOpponent);
  }

  return (
    <div className="mt-7 space-y-6">
      {/* Cabecera + Crear nuevo reto 1v1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Creador de reto 1v1 */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-sm transition-colors duration-300 lg:col-span-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Swords size={18} aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--text-main)]">
                Lanzar Reto 1v1
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Elige un juego, selecciona un rival y juega para fijar tu puntaje.
              </p>
            </div>
          </div>

          {/* Paso 1: Elegir minijuego */}
          <div className="mt-4">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
              1. Elige el minijuego
            </span>
            <div className="grid grid-cols-2 gap-2">
              {DUEL_SUPPORTED_GAMES.map((g) => {
                const active = selectedGameId === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGameId(g.id)}
                    aria-pressed={active}
                    className={`min-h-[42px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {g.title}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paso 2: Seleccionar usuario rival */}
          <div className="mt-4">
            <label
              htmlFor="duel-opponent-search"
              className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]"
            >
              2. Selecciona a tu oponente
            </label>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                aria-hidden="true"
              />
              <input
                id="duel-opponent-search"
                type="text"
                value={opponentQuery}
                onChange={(e) => setOpponentQuery(e.target.value)}
                placeholder="Buscar jugador registrado…"
                className="min-h-[40px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] pl-8 pr-3 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </div>

            <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] divide-y divide-[var(--border-subtle)]">
              {isLoadingUsers && directory.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-[var(--text-muted)]">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  <span>Cargando jugadores…</span>
                </div>
              ) : directory.length === 0 ? (
                <p className="px-3 py-5 text-center text-xs text-[var(--text-muted)]">
                  No se encontraron otros jugadores con ese nombre.
                </p>
              ) : (
                directory.map((person) => {
                  const name = getAuthorDisplayName(person);
                  const isSelected = selectedOpponent?.id === person.id;
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => {
                        setSelectedOpponent(person);
                        setFormError(null);
                      }}
                      className={`flex w-full items-center justify-between gap-2.5 px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'bg-[var(--accent-soft)]'
                          : 'hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar src={person.avatar_url} name={name} size="sm" />
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="truncate text-xs font-semibold text-[var(--text-main)]">
                            {name}
                          </span>
                          <OwnerBadge
                            role={person.role}
                            badge={person.badge}
                            size="xs"
                          />
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2
                          size={15}
                          className="shrink-0 text-[var(--accent-primary)]"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {formError && (
            <div
              role="alert"
              className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200"
            >
              <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleStartDuel}
            className="mt-4 min-h-[46px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 text-sm font-bold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] active:scale-[0.99] transition-all"
          >
            <Play size={15} className="fill-current" aria-hidden="true" />
            <span>
              {selectedOpponent
                ? `Jugar y retar a ${getAuthorDisplayName(selectedOpponent)}`
                : 'Jugar y enviar reto'}
            </span>
          </button>
        </div>

        {/* Columna derecha: Retos pendientes recibidos + enviados */}
        <div className="space-y-5 lg:col-span-7">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-sm transition-colors duration-300">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-[var(--text-main)]">
                  Retos recibidos
                </h2>
                {incomingPending.length > 0 && (
                  <span className="rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-bold text-[var(--accent-primary)] tabular-nums">
                    {incomingPending.length}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="min-h-[34px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 transition-colors"
              >
                <RefreshCw
                  size={13}
                  className={isLoading ? 'animate-spin' : ''}
                  aria-hidden="true"
                />
                <span>Actualizar</span>
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200"
              >
                <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="mt-4 space-y-2.5">
              {isLoading && challenges.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--text-muted)]">
                  <Loader2 size={15} className="animate-spin text-[var(--accent-primary)]" aria-hidden="true" />
                  <span>Buscando duelos…</span>
                </div>
              ) : incomingPending.length === 0 ? (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-7 text-center">
                  <Users size={20} className="mx-auto text-[var(--text-muted)]" aria-hidden="true" />
                  <p className="mt-2 text-sm font-medium text-[var(--text-main)]">
                    No tienes retos pendientes
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Cuando alguien te rete en Senda Astral o Bastión de Runas aparecerá aquí listo para jugar.
                  </p>
                </div>
              ) : (
                incomingPending.map((ch) => {
                  const challengerName = getAuthorDisplayName(ch.challenger);
                  return (
                    <div
                      key={ch.id}
                      className="flex flex-col gap-3 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)]/35 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          src={ch.challenger.avatar_url}
                          name={challengerName}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-bold text-[var(--text-main)]">
                              {challengerName}
                            </span>
                            <OwnerBadge
                              role={ch.challenger.role}
                              badge={ch.challenger.badge}
                              size="xs"
                            />
                            <span className="text-[11px] text-[var(--text-muted)]">
                              te retó
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                            <strong>{getDuelGameTitle(ch.game_id)}</strong> · Marca a vencer:{' '}
                            <strong className="tabular-nums text-[var(--accent-primary)]">
                              {ch.challenger_score.toLocaleString('es-ES')} pts
                            </strong>
                          </p>
                          <p className="mt-0.5 text-[11px] text-[var(--text-muted)] tabular-nums">
                            {formatRelativeDate(ch.created_at)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onLaunchAcceptDuel(ch)}
                        className="min-h-[42px] shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 text-xs font-bold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all whitespace-nowrap"
                      >
                        <Play size={13} className="fill-current" aria-hidden="true" />
                        <span>Aceptar y Jugar</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Retos enviados esperando respuesta */}
            {outgoingPending.length > 0 && (
              <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Retos enviados esperando rival ({outgoingPending.length})
                </h3>
                <div className="mt-2.5 space-y-2">
                  {outgoingPending.map((ch) => {
                    const oppName = getAuthorDisplayName(ch.challenged);
                    return (
                      <div
                        key={ch.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar src={ch.challenged.avatar_url} name={oppName} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--text-main)]">
                              vs {oppName} · {getDuelGameTitle(ch.game_id)}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                              Tu marca: {ch.challenger_score.toLocaleString('es-ES')} pts ·{' '}
                              {formatRelativeDate(ch.created_at)}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-300">
                          <Clock size={12} aria-hidden="true" />
                          <span>Pendiente</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historial de Duelos Completados */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-amber-500" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-[var(--text-main)]">
            Resultados de Duelos 1v1
          </h2>
        </div>

        {completedDuels.length === 0 ? (
          <p className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-6 text-center text-xs text-[var(--text-muted)]">
            Todavía no tienes duelos finalizados. Envía o acepta un reto arriba para ver al ganador aquí.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {completedDuels.map((ch) => {
              const p1Name = getAuthorDisplayName(ch.challenger);
              const p2Name = getAuthorDisplayName(ch.challenged);
              const s1 = ch.challenger_score;
              const s2 = ch.challenged_score ?? 0;
              const isTie = s1 === s2;
              const winnerId = isTie
                ? null
                : s1 > s2
                  ? ch.challenger_id
                  : ch.challenged_id;
              const winnerName = isTie
                ? 'Empate'
                : winnerId === ch.challenger_id
                  ? p1Name
                  : p2Name;
              const iWon = winnerId === user.id;

              return (
                <div
                  key={ch.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    isTie
                      ? 'border-[var(--border-subtle)] bg-[var(--bg-subtle)]'
                      : iWon
                        ? 'border-emerald-500/40 bg-emerald-500/8'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[var(--accent-primary)]">
                      {getDuelGameTitle(ch.game_id)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        isTie
                          ? 'text-[var(--text-secondary)]'
                          : iWon
                            ? 'text-emerald-600 dark:text-emerald-300'
                            : 'text-amber-600 dark:text-amber-300'
                      }`}
                    >
                      <Crown size={12} aria-hidden="true" />
                      <span>
                        {isTie
                          ? 'Empate'
                          : iWon
                            ? '¡Ganaste!'
                            : `Ganó ${winnerName}`}
                      </span>
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[var(--text-main)]">
                        {p1Name}
                        {ch.challenger_id === user.id ? ' (Tú)' : ''}
                      </p>
                      <p
                        className={`mt-0.5 font-display text-lg font-bold tabular-nums ${
                          winnerId === ch.challenger_id
                            ? 'text-emerald-600 dark:text-emerald-300'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {s1.toLocaleString('es-ES')}
                      </p>
                    </div>

                    <span className="text-xs font-bold text-[var(--text-muted)]">
                      VS
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[var(--text-main)]">
                        {p2Name}
                        {ch.challenged_id === user.id ? ' (Tú)' : ''}
                      </p>
                      <p
                        className={`mt-0.5 font-display text-lg font-bold tabular-nums ${
                          winnerId === ch.challenged_id
                            ? 'text-emerald-600 dark:text-emerald-300'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {s2.toLocaleString('es-ES')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
