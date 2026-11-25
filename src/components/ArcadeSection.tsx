import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Crown,
  Eye,
  EyeOff,
  Gamepad2,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { generateAiArcadeChallenge } from '../lib/ai';
import {
  addCustomArcadeChallenge,
  deleteArcadeScore,
  deleteCustomArcadeChallenge,
  fetchArcadeLeaderboard,
  formatDifficultyLabel,
  getArcadeHighScores,
  loadArcadeGames,
  setFeaturedArcadeGame,
  toggleHiddenArcadeGame,
  type ArcadeEngineId,
  type ArcadeGameConfig,
  type ArcadeLeaderboardEntry,
} from '../lib/arcade';
import { ArcadeGameModal } from './ArcadeGameModal';
import { Avatar } from './Avatar';
import { OwnerBadge } from './OwnerBadge';

function GamePreviewArtwork({ game }: { game: ArcadeGameConfig }) {
  const { bg, primary, accent, danger } = game.palette;

  return (
    <div className="relative flex h-44 w-full items-center justify-center overflow-hidden border-b border-white/[0.07] bg-[#090B12]">
      <svg
        viewBox="0 0 360 180"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`glow-${game.id}`} cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor={primary} stopOpacity="0.28" />
            <stop offset="100%" stopColor={bg} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="360" height="180" fill={bg} />
        <rect width="360" height="180" fill={`url(#glow-${game.id})`} />
        <g stroke="rgba(255,255,255,0.06)" strokeWidth="1">
          <line x1="60" y1="0" x2="60" y2="180" />
          <line x1="120" y1="0" x2="120" y2="180" />
          <line x1="180" y1="0" x2="180" y2="180" />
          <line x1="240" y1="0" x2="240" y2="180" />
          <line x1="300" y1="0" x2="300" y2="180" />
          <line x1="0" y1="45" x2="360" y2="45" />
          <line x1="0" y1="90" x2="360" y2="90" />
          <line x1="0" y1="135" x2="360" y2="135" />
        </g>

        {game.engine === 'bastion' ? (
          <>
            <line
              x1="20"
              y1="152"
              x2="340"
              y2="152"
              stroke={primary}
              strokeWidth="2.5"
              strokeOpacity="0.7"
            />
            <polygon
              points="180,108 198,140 180,132 162,140"
              fill={primary}
            />
            <rect x="178" y="68" width="4" height="24" fill={accent} />
            <polygon
              points="115,44 132,32 146,44 132,58"
              fill="#1E152B"
              stroke={danger}
              strokeWidth="2.2"
            />
            <polygon
              points="232,52 252,38 268,52 252,68"
              fill="#1E152B"
              stroke={accent}
              strokeWidth="2.2"
            />
            <circle cx="180" cy="40" r="14" fill="#23162D" stroke={danger} strokeWidth="2.2" />
          </>
        ) : (
          <>
            <circle
              cx="180"
              cy="92"
              r="54"
              stroke={primary}
              strokeOpacity="0.35"
              strokeDasharray="6 6"
              fill="none"
            />
            <polygon
              points="180,58 202,114 180,102 158,114"
              fill={primary}
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
            <polygon points="104,54 114,64 104,74 94,64" fill={accent} />
            <polygon points="264,104 274,114 264,124 254,114" fill={accent} />
            <circle cx="256" cy="52" r="13" fill="#22121D" stroke={danger} strokeWidth="2.2" />
            <circle cx="96" cy="126" r="10" fill="#22121D" stroke={danger} strokeWidth="2.2" />
          </>
        )}
      </svg>
    </div>
  );
}

export function ArcadeSection() {
  const { user, isOwner } = useAuth();
  const [games, setGames] = useState<ArcadeGameConfig[]>(() => loadArcadeGames());
  const [highScores, setHighScores] = useState<Record<string, number>>(() =>
    getArcadeHighScores()
  );
  const [activeGame, setActiveGame] = useState<ArcadeGameConfig | null>(null);

  // Top 10 Global (public.arcade_scores + profiles)
  const [selectedBoardGameId, setSelectedBoardGameId] = useState<string>(
    () => loadArcadeGames()[0]?.id ?? 'senda-astral'
  );
  const [leaderboard, setLeaderboard] = useState<ArcadeLeaderboardEntry[]>([]);
  const [isLoadingBoard, setIsLoadingBoard] = useState(true);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [boardRefreshKey, setBoardRefreshKey] = useState(0);
  const [confirmDeleteScoreId, setConfirmDeleteScoreId] = useState<string | null>(
    null
  );
  const [deletingScoreId, setDeletingScoreId] = useState<string | null>(null);

  // Modal exclusivo del Dueño: crear desafío retro-fantasía con Gemini gratuito
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [selectedEngine, setSelectedEngine] = useState<ArcadeEngineId>('astral');
  const [isGenerating, setIsGenerating] = useState(false);
  const [creatorError, setCreatorError] = useState<string | null>(null);

  const refreshHighScores = useCallback(() => {
    setHighScores(getArcadeHighScores());
    setBoardRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    setGames(loadArcadeGames());
    setHighScores(getArcadeHighScores());
  }, []);

  const visibleGames = isOwner ? games : games.filter((g) => !g.isHidden);
  const featuredGame = visibleGames.find((g) => g.isFeatured) ?? null;
  const catalogGames = featuredGame
    ? visibleGames.filter((g) => g.id !== featuredGame.id)
    : visibleGames;

  useEffect(() => {
    if (
      visibleGames.length > 0 &&
      !visibleGames.some((g) => g.id === selectedBoardGameId)
    ) {
      setSelectedBoardGameId(visibleGames[0].id);
    }
  }, [visibleGames, selectedBoardGameId]);

  useEffect(() => {
    let active = true;
    async function loadBoard() {
      if (!selectedBoardGameId) return;
      setIsLoadingBoard(true);
      setBoardError(null);
      setConfirmDeleteScoreId(null);
      try {
        const entries = await fetchArcadeLeaderboard(selectedBoardGameId, 10);
        if (active) {
          setLeaderboard(entries);
        }
      } catch (err) {
        if (active) {
          setBoardError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el Top 10 Global.'
          );
        }
      } finally {
        if (active) {
          setIsLoadingBoard(false);
        }
      }
    }
    void loadBoard();
    return () => {
      active = false;
    };
  }, [selectedBoardGameId, boardRefreshKey]);

  async function handleDeleteScore(scoreId: string) {
    if (!isOwner || deletingScoreId) return;
    setDeletingScoreId(scoreId);
    setBoardError(null);
    try {
      await deleteArcadeScore(scoreId);
      setLeaderboard((prev) => prev.filter((item) => item.id !== scoreId));
      setConfirmDeleteScoreId(null);
    } catch (err) {
      setBoardError(
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el puntaje del marcador.'
      );
    } finally {
      setDeletingScoreId(null);
    }
  }

  function handleToggleFeatured(gameId: string) {
    if (!isOwner) return;
    setGames(setFeaturedArcadeGame(gameId));
  }

  function handleToggleHidden(gameId: string) {
    if (!isOwner) return;
    setGames(toggleHiddenArcadeGame(gameId));
  }

  function handleDeleteCustom(gameId: string) {
    if (!isOwner) return;
    setGames(deleteCustomArcadeChallenge(gameId));
  }

  async function handleGenerateChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOwner || isGenerating) return;
    setCreatorError(null);

    if (promptInput.trim().length < 3) {
      setCreatorError('Escribe una idea breve para tu desafío (ej. "Dragones de obsidiana").');
      return;
    }

    setIsGenerating(true);
    try {
      const challenge = await generateAiArcadeChallenge({
        prompt: promptInput.trim(),
        baseEngine: selectedEngine,
      });
      const updated = addCustomArcadeChallenge(challenge);
      setGames(updated);
      setPromptInput('');
      setIsCreatorOpen(false);
    } catch (err) {
      setCreatorError(
        err instanceof Error
          ? err.message
          : 'No se pudo crear el desafío con Gemini.'
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section
      aria-labelledby="arcade-heading"
      className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 md:px-8 md:py-10 md:pb-20"
    >
      {/* Cabecera Arcade */}
      <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            id="arcade-heading"
            className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            Arcade
          </h1>
          <p className="mt-1 text-sm text-[#8F99AB]">
            Minijuegos retro-fantasía jugables al instante desde tu navegador o celular.
          </p>
        </div>

        {isOwner && (
          <button
            type="button"
            onClick={() => {
              setCreatorError(null);
              setIsCreatorOpen(true);
            }}
            className="min-h-[44px] self-start sm:self-auto inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/14 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-400/22 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Crown size={16} aria-hidden="true" />
            <span>Crear desafío con IA</span>
          </button>
        )}
      </div>

      {/* Juego destacado arriba */}
      {featuredGame && (
        <article className="mt-7 overflow-hidden rounded-2xl border border-amber-400/30 bg-[#11151E]">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <div className="h-full [&>div]:h-full [&>div]:min-h-[220px] [&>div]:border-b lg:[&>div]:border-b-0 lg:[&>div]:border-r">
                <GamePreviewArtwork game={featuredGame} />
              </div>
            </div>

            <div className="flex flex-col justify-between p-6 sm:p-7 lg:col-span-6">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
                    <Star size={13} className="fill-amber-300" aria-hidden="true" />
                    <span>Destacado del Arcade</span>
                  </span>
                  <span aria-hidden="true" className="text-[#566072]">
                    ·
                  </span>
                  <span className="text-[#8FB9FF] font-medium">
                    {featuredGame.genre}
                  </span>
                  <span aria-hidden="true" className="text-[#566072]">
                    ·
                  </span>
                  <span className="text-[#9AA4B6]">
                    {formatDifficultyLabel(featuredGame.difficulty)}
                  </span>
                </div>

                <h2 className="mt-2.5 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {featuredGame.title}
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-[#A8B2C2]">
                  {featuredGame.lore}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#8F99AB]">
                  <span className="inline-flex items-center gap-1.5 font-medium text-[#D5DCE6]">
                    <Trophy size={14} className="text-amber-300" aria-hidden="true" />
                    <span>
                      Récord:{' '}
                      <strong className="tabular-nums text-white">
                        {(highScores[featuredGame.id] ?? 0).toLocaleString('es-ES')}
                      </strong>
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-[#566072]">
                    ·
                  </span>
                  <span>{featuredGame.controlsHint}</span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveGame(featuredGame)}
                  className="min-h-[46px] inline-flex items-center gap-2 rounded-xl bg-[#388BFF] px-5 py-2.5 text-sm font-bold text-[#06101F] hover:bg-[#529BFF] active:scale-[0.98] transition-all"
                >
                  <Play size={16} className="fill-current" aria-hidden="true" />
                  <span>Jugar ahora</span>
                </button>

                {isOwner && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleToggleFeatured(featuredGame.id)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-400/10 px-3.5 text-xs font-medium text-amber-200 hover:bg-amber-400/20 transition-colors"
                    >
                      <Star size={14} aria-hidden="true" />
                      <span>Quitar destacado</span>
                    </button>

                    {!featuredGame.isBuiltIn && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustom(featuredGame.id)}
                        className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] px-3 text-xs font-medium text-[#9AA4B6] hover:border-red-500/35 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        <span>Eliminar</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </article>
      )}

      {/* Catálogo de juegos disponibles */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold tracking-tight text-white">
            Catálogo de minijuegos
          </h2>
          <span className="text-xs text-[#8B95A5] tabular-nums">
            {visibleGames.length}{' '}
            {visibleGames.length === 1 ? 'juego' : 'juegos'}
          </span>
        </div>

        {catalogGames.length === 0 && !featuredGame ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#11151D] p-10 text-center">
            <Gamepad2 size={28} className="mx-auto text-[#7FB2FF]" aria-hidden="true" />
            <p className="mt-3 text-sm text-[#9AA4B6]">
              No hay minijuegos visibles en este momento.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {catalogGames.map((game) => (
              <article
                key={game.id}
                className={`overflow-hidden rounded-2xl border bg-[#11151D] transition-colors ${
                  game.isHidden
                    ? 'border-dashed border-white/[0.15] opacity-65'
                    : 'border-white/[0.08] hover:border-white/[0.16]'
                }`}
              >
                <GamePreviewArtwork game={game} />

                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#7FB2FF]">
                        {game.genre}
                      </span>
                      <span aria-hidden="true" className="text-[#566072]">
                        ·
                      </span>
                      <span className="text-[#9AA4B6]">
                        {formatDifficultyLabel(game.difficulty)}
                      </span>
                      {game.createdByOwner && (
                        <>
                          <span aria-hidden="true" className="text-[#566072]">
                            ·
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
                            <Sparkles size={11} aria-hidden="true" />
                            <span>Edición Dueño</span>
                          </span>
                        </>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1 text-[#CBD5E1] tabular-nums">
                      <Trophy size={13} className="text-amber-300" aria-hidden="true" />
                      {(highScores[game.id] ?? 0).toLocaleString('es-ES')}
                    </span>
                  </div>

                  <h3 className="mt-2 font-display text-xl font-bold text-white">
                    {game.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#9AA4B6] line-clamp-2">
                    {game.lore}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveGame(game)}
                      className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#388BFF] px-4 py-2 text-sm font-bold text-[#06101F] hover:bg-[#529BFF] active:scale-[0.98] transition-all"
                    >
                      <Play size={15} className="fill-current" aria-hidden="true" />
                      <span>Jugar</span>
                    </button>

                    {isOwner && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(game.id)}
                          title="Destacar en portada del Arcade"
                          aria-label={`Destacar ${game.title}`}
                          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-white/[0.09] px-3 text-xs font-medium text-[#CBD5E1] hover:border-amber-400/40 hover:text-amber-300 transition-colors"
                        >
                          <Star size={14} aria-hidden="true" />
                          <span>Destacar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleHidden(game.id)}
                          title={game.isHidden ? 'Mostrar en catálogo' : 'Ocultar a lectores'}
                          aria-label={game.isHidden ? 'Mostrar juego' : 'Ocultar juego'}
                          className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-white/[0.09] text-[#9AA4B6] hover:text-white transition-colors"
                        >
                          {game.isHidden ? (
                            <Eye size={15} aria-hidden="true" />
                          ) : (
                            <EyeOff size={15} aria-hidden="true" />
                          )}
                        </button>

                        {!game.isBuiltIn && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustom(game.id)}
                            title="Eliminar desafío"
                            aria-label={`Eliminar ${game.title}`}
                            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-white/[0.09] text-[#8F99AB] hover:border-red-500/35 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Tabla de Récords: Top 10 Global */}
      <div
        aria-labelledby="arcade-leaderboard-heading"
        className="mt-10 rounded-2xl border border-white/[0.08] bg-[#11151D] p-5 sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.07] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/12 text-amber-300">
              <Trophy size={18} aria-hidden="true" />
            </div>
            <div>
              <h2
                id="arcade-leaderboard-heading"
                className="font-display text-xl font-bold tracking-tight text-white"
              >
                Top 10 Global
              </h2>
              <p className="text-xs text-[#8F99AB]">
                Mejores puntajes verificados de la comunidad de Trama.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setBoardRefreshKey((prev) => prev + 1)}
            disabled={isLoadingBoard}
            aria-label="Actualizar tabla de récords"
            className="min-h-[40px] self-start sm:self-auto inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-[#171C27] px-3 text-xs font-medium text-[#D5DCE6] hover:border-white/[0.2] hover:text-white disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              size={14}
              className={isLoadingBoard ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Filtro por minijuego */}
        {visibleGames.length > 0 && (
          <div
            role="tablist"
            aria-label="Filtrar Top 10 por juego"
            className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {visibleGames.map((game) => {
              const isSelected = selectedBoardGameId === game.id;
              return (
                <button
                  key={game.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedBoardGameId(game.id)}
                  className={`min-h-[40px] shrink-0 rounded-xl border px-3.5 text-xs font-semibold transition-colors ${
                    isSelected
                      ? 'border-[#388BFF]/60 bg-[#388BFF]/15 text-white'
                      : 'border-white/[0.08] bg-[#0B0E14] text-[#9AA4B6] hover:border-white/[0.16] hover:text-white'
                  }`}
                >
                  {game.title}
                </button>
              );
            })}
          </div>
        )}

        {boardError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200"
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-400" aria-hidden="true" />
            <span>{boardError}</span>
          </div>
        )}

        <div className="mt-4">
          {isLoadingBoard ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-14 rounded-xl bg-[#0B0E14]" />
              <div className="h-14 rounded-xl bg-[#0B0E14]" />
              <div className="h-14 rounded-xl bg-[#0B0E14]" />
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-[#0B0E14] px-4 py-8 text-center">
              <Trophy size={24} className="mx-auto text-[#637086]" aria-hidden="true" />
              <p className="mt-2.5 text-sm font-medium text-[#CBD5E1]">
                Aún no hay récords registrados en este minijuego
              </p>
              <p className="mt-1 text-xs text-[#838FA4]">
                Inicia una partida con tu cuenta para reclamar el puesto #1.
              </p>
            </div>
          ) : (
            <ol className="space-y-2">
              {leaderboard.map((entry, idx) => {
                const rank = idx + 1;
                const isCurrentUser = user?.id === entry.user_id;
                const playerName =
                  entry.player.username?.trim() || 'Jugador de Trama';
                const isConfirming = confirmDeleteScoreId === entry.id;
                const isDeleting = deletingScoreId === entry.id;

                const rankClasses =
                  rank === 1
                    ? 'border-amber-400/50 bg-amber-400/18 text-amber-200'
                    : rank === 2
                      ? 'border-slate-300/35 bg-slate-300/12 text-slate-200'
                      : rank === 3
                        ? 'border-orange-400/40 bg-orange-400/14 text-orange-200'
                        : 'border-white/[0.08] bg-[#141925] text-[#8F99AB]';

                return (
                  <li
                    key={entry.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                      isCurrentUser
                        ? 'border-[#388BFF]/40 bg-[#388BFF]/[0.08]'
                        : 'border-white/[0.06] bg-[#0B0E14]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold tabular-nums ${rankClasses}`}
                      >
                        #{rank}
                      </span>

                      <Avatar
                        src={entry.player.avatar_url}
                        name={playerName}
                        size="sm"
                      />

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-white">
                            {playerName}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[11px] font-medium text-[#7FB2FF]">
                              (Tú)
                            </span>
                          )}
                          <OwnerBadge
                            role={entry.player.role}
                            badge={entry.player.badge}
                            size="xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <span className="font-display text-base font-bold tabular-nums text-white">
                          {entry.score.toLocaleString('es-ES')}
                        </span>
                        <span className="ml-1 text-[11px] text-[#7D879A]">
                          pts
                        </span>
                      </div>

                      {isOwner && (
                        isConfirming ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => void handleDeleteScore(entry.id)}
                              className="min-h-[34px] rounded-lg bg-red-500/90 px-2.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                            >
                              {isDeleting ? 'Borrando…' : 'Confirmar'}
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => setConfirmDeleteScoreId(null)}
                              className="min-h-[34px] rounded-lg border border-white/[0.1] px-2 text-[11px] text-[#9AA4B6] hover:text-white transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteScoreId(entry.id)}
                            title="Reiniciar / borrar puntaje sospechoso"
                            aria-label={`Borrar puntaje de ${playerName}`}
                            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border border-white/[0.08] text-[#8F99AB] hover:border-red-500/35 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {/* Modal de juego HTML5 Canvas */}
      <ArcadeGameModal
        game={activeGame}
        onClose={() => setActiveGame(null)}
        onHighScoreUpdated={refreshHighScores}
      />

      {/* Modal exclusivo del Dueño: generar desafío con Gemini gratuito */}
      {isOwner && isCreatorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcade-creator-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-amber-400/25 bg-[#10141D] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <Crown size={14} aria-hidden="true" />
                  <span>Control exclusivo del Dueño</span>
                </div>
                <h2
                  id="arcade-creator-title"
                  className="mt-1 font-display text-xl font-bold text-white"
                >
                  Crear desafío Arcade con IA
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatorOpen(false)}
                aria-label="Cerrar"
                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-[#8F99AB] hover:bg-white/[0.06] hover:text-white"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleGenerateChallenge} className="mt-5 space-y-4">
              <div>
                <span className="mb-2 block text-xs font-medium text-[#CBD5E1]">
                  Modo de juego base
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedEngine('astral')}
                    className={`min-h-[44px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
                      selectedEngine === 'astral'
                        ? 'border-[#388BFF] bg-[#388BFF]/15 text-white'
                        : 'border-white/[0.1] bg-[#0B0E14] text-[#9AA4B6] hover:text-white'
                    }`}
                  >
                    Senda Astral (Esquiva)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedEngine('bastion')}
                    className={`min-h-[44px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
                      selectedEngine === 'bastion'
                        ? 'border-[#388BFF] bg-[#388BFF]/15 text-white'
                        : 'border-white/[0.1] bg-[#0B0E14] text-[#9AA4B6] hover:text-white'
                    }`}
                  >
                    Bastión (Defensa)
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="arcade-ai-prompt"
                  className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
                >
                  Temática y ambiente del desafío
                </label>
                <textarea
                  id="arcade-ai-prompt"
                  rows={3}
                  maxLength={320}
                  value={promptInput}
                  onChange={(event) => setPromptInput(event.target.value)}
                  placeholder="Ej. Tormenta de dragones carmesí en un templo flotante con dificultad extrema"
                  className="w-full resize-none rounded-xl border border-white/[0.1] bg-[#090C12] px-3.5 py-2.5 text-sm text-white placeholder:text-[#667085] focus:border-[#388BFF] focus:outline-none focus:ring-2 focus:ring-[#388BFF]/30"
                />
              </div>

              {creatorError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-500/35 bg-red-500/12 px-3 py-2.5 text-xs text-red-100"
                >
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-400" aria-hidden="true" />
                  <span>{creatorError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setIsCreatorOpen(false)}
                  className="min-h-[44px] rounded-xl px-4 text-xs font-medium text-[#9AA4B6] hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isGenerating || !promptInput.trim()}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-bold text-[#090B0E] hover:bg-amber-300 disabled:opacity-50 transition-colors"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                      <span>Diseñando…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} aria-hidden="true" />
                      <span>Generar y destacar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
