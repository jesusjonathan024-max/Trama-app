import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Code2,
  Crown,
  Eye,
  EyeOff,
  Flame,
  Gamepad2,
  Loader2,
  Medal,
  Play,
  RefreshCw,
  Sparkles,
  Star,
  Swords,
  Target,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ENABLE_AI_FEATURES, generateAiArcadeChallenge } from '../lib/ai';
import {
  addCustomArcadeChallenge,
  deleteArcadeScore,
  deleteCustomArcadeChallenge,
  fetchArcadeLeaderboard,
  fetchTodayBestScoreForGame,
  fetchUserArcadeRecords,
  formatDifficultyLabel,
  getArcadeHighScores,
  loadArcadeGames,
  setFeaturedArcadeGame,
  toggleHiddenArcadeGame,
  type ArcadeEngineId,
  type ArcadeGameConfig,
  type ArcadeLeaderboardEntry,
  type ArcadeLeaderboardPeriod,
} from '../lib/arcade';
import {
  getDailyArcadeChallenge,
  getLocalDailyChallengeBest,
  getTodayStartIso,
} from '../lib/phase3';
import {
  completeArcadeChallenge,
  createArcadeChallenge,
  fetchUserArcadeChallenges,
  normalizeDuelGameId,
  type ArcadeChallengeRecord,
  type DuelGameId,
} from '../lib/phase4';
import { getAuthorDisplayName, type PostAuthor } from '../lib/posts';
import { ArcadeChallengesPanel } from './ArcadeChallengesPanel';
import {
  ArcadeGameModal,
  type ArcadeChallengeMode,
} from './ArcadeGameModal';
import { Avatar } from './Avatar';
import { CommunityArcadePanel } from './CommunityArcadePanel';
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

        {game.engine === 'pulso' ? (
          <>
            <line x1="90" y1="0" x2="90" y2="180" stroke="rgba(255,255,255,0.12)" />
            <line x1="180" y1="0" x2="180" y2="180" stroke="rgba(255,255,255,0.12)" />
            <line x1="270" y1="0" x2="270" y2="180" stroke="rgba(255,255,255,0.12)" />
            <line
              x1="0"
              y1="142"
              x2="360"
              y2="142"
              stroke="var(--accent-primary)"
              strokeWidth="3"
              strokeOpacity="0.85"
            />
            <rect x="26" y="42" width="38" height="14" rx="7" fill="var(--accent-primary)" />
            <rect x="116" y="88" width="38" height="14" rx="7" fill="#38BDF8" />
            <rect x="206" y="54" width="38" height="14" rx="7" fill="#F59E0B" />
            <rect x="296" y="106" width="38" height="14" rx="7" fill="#EC4899" />
            <circle cx="135" cy="142" r="18" stroke="#38BDF8" strokeWidth="2" fill="none" opacity="0.6" />
          </>
        ) : game.engine === 'codice' ? (
          <>
            {[0, 1, 2, 3].map((col) =>
              [0, 1, 2].map((row) => {
                const isLit =
                  (col === 0 && row === 1) ||
                  (col === 1 && row === 1) ||
                  (col === 1 && row === 0) ||
                  (col === 2 && row === 0) ||
                  (col === 2 && row === 1) ||
                  (col === 3 && row === 1);
                return (
                  <rect
                    key={`${col}-${row}`}
                    x={86 + col * 48}
                    y={30 + row * 42}
                    width="38"
                    height="34"
                    rx="8"
                    fill={isLit ? 'var(--accent-primary)' : '#141926'}
                    fillOpacity={isLit ? 0.32 : 0.9}
                    stroke={isLit ? 'var(--accent-primary)' : 'rgba(255,255,255,0.12)'}
                    strokeWidth="2"
                  />
                );
              })
            )}
            <path
              d="M105 89H153V47H201V89H249"
              stroke="#FFFFFF"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </>
        ) : game.engine === 'salto' ? (
          <>
            <rect x="52" y="138" width="84" height="11" rx="5.5" fill="var(--accent-primary)" />
            <rect x="196" y="106" width="76" height="11" rx="5.5" fill="#38BDF8" />
            <rect x="98" y="70" width="70" height="11" rx="5.5" fill="#10B981" />
            <rect x="220" y="38" width="66" height="11" rx="5.5" fill="#F59E0B" />
            <circle cx="132" cy="48" r="13" fill="var(--accent-primary)" stroke="#FFFFFF" strokeWidth="2" />
            <circle cx="282" cy="86" r="10" fill="#2A101B" stroke="#F43F5E" strokeWidth="2.2" />
            <polygon points="232,88 238,94 232,100 226,94" fill="#FBBF24" />
          </>
        ) : game.engine === 'oraculo' ? (
          <>
            <circle
              cx="112"
              cy="90"
              r="46"
              fill="var(--accent-primary)"
              fillOpacity="0.18"
              stroke="var(--accent-primary)"
              strokeWidth="2.5"
            />
            <text
              x="112"
              y="104"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="42"
              fontWeight="800"
              fontFamily="sans-serif"
            >
              ?
            </text>
            <rect x="184" y="42" width="136" height="20" rx="7" fill="#171E2E" stroke="rgba(255,255,255,0.14)" />
            <rect x="184" y="72" width="136" height="20" rx="7" fill="#10B981" fillOpacity="0.24" stroke="#10B981" strokeWidth="1.8" />
            <rect x="184" y="102" width="136" height="20" rx="7" fill="#171E2E" stroke="rgba(255,255,255,0.14)" />
            <rect x="184" y="136" width="110" height="6" rx="3" fill="var(--accent-primary)" />
          </>
        ) : game.engine === 'bastion' ? (
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

type ArcadeSectionTab = 'oficiales' | 'retos' | 'comunidad';

type ActiveDuelContext =
  | {
      kind: 'create';
      gameId: DuelGameId;
      opponent: PostAuthor;
    }
  | {
      kind: 'accept';
      challenge: ArcadeChallengeRecord;
    };

interface ArcadeSectionProps {
  onOpenAuth?: () => void;
}

export function ArcadeSection({ onOpenAuth }: ArcadeSectionProps = {}) {
  const { user, isOwner } = useAuth();
  const [sectionTab, setSectionTab] = useState<ArcadeSectionTab>('oficiales');
  const [games, setGames] = useState<ArcadeGameConfig[]>(() => loadArcadeGames());
  const [highScores, setHighScores] = useState<Record<string, number>>(() =>
    getArcadeHighScores()
  );
  const [activeGame, setActiveGame] = useState<ArcadeGameConfig | null>(null);
  const [activeDuel, setActiveDuel] = useState<ActiveDuelContext | null>(null);

  // Retos 1v1 entre amigos (public.arcade_challenges)
  const [challenges, setChallenges] = useState<ArcadeChallengeRecord[]>([]);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(false);
  const [challengesError, setChallengesError] = useState<string | null>(null);

  // Reto Diario y Récords Personales sincronizados con Supabase
  const dailyChallenge = useMemo(() => getDailyArcadeChallenge(), []);
  const [remoteRecords, setRemoteRecords] = useState<Record<string, number>>(
    {}
  );
  const [dailyTodayBest, setDailyTodayBest] = useState<number>(() =>
    getLocalDailyChallengeBest(dailyChallenge.dateKey, dailyChallenge.gameId)
  );

  // Top 10 Global (Esta semana, Este mes, Histórico)
  const [selectedBoardGameId, setSelectedBoardGameId] = useState<string>(
    () => loadArcadeGames()[0]?.id ?? 'senda-astral'
  );
  const [boardPeriod, setBoardPeriod] =
    useState<ArcadeLeaderboardPeriod>('week');
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
  const [selectedEngine, setSelectedEngine] = useState<'astral' | 'bastion'>('astral');
  const [isGenerating, setIsGenerating] = useState(false);
  const [creatorError, setCreatorError] = useState<string | null>(null);

  const loadChallenges = useCallback(async () => {
    if (!user?.id) {
      setChallenges([]);
      return;
    }
    setIsLoadingChallenges(true);
    setChallengesError(null);
    try {
      const list = await fetchUserArcadeChallenges(user.id);
      setChallenges(list);
    } catch (err) {
      setChallengesError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar tus retos 1v1.'
      );
    } finally {
      setIsLoadingChallenges(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadChallenges();
  }, [loadChallenges]);

  const pendingIncomingChallengesCount = useMemo(
    () =>
      challenges.filter(
        (c) =>
          user?.id &&
          c.challenged_id === user.id &&
          c.status.toLowerCase() !== 'completed'
      ).length,
    [challenges, user?.id]
  );

  function handleLaunchCreateDuel(gameId: DuelGameId, opponent: PostAuthor) {
    const targetGame =
      games.find((g) => g.id === gameId) ?? games[0] ?? null;
    if (!targetGame) return;
    setActiveDuel({ kind: 'create', gameId, opponent });
    setActiveGame(targetGame);
  }

  function handleLaunchAcceptDuel(challenge: ArcadeChallengeRecord) {
    const normalizedId = normalizeDuelGameId(challenge.game_id);
    const targetGame =
      games.find((g) => g.id === normalizedId) ?? games[0] ?? null;
    if (!targetGame) return;
    setActiveDuel({ kind: 'accept', challenge });
    setActiveGame(targetGame);
  }

  const activeChallengeMode: ArcadeChallengeMode | null = useMemo(() => {
    if (!activeDuel) return null;
    if (activeDuel.kind === 'create') {
      return {
        kind: 'create',
        opponentName: getAuthorDisplayName(activeDuel.opponent),
      };
    }
    return {
      kind: 'accept',
      opponentName: getAuthorDisplayName(activeDuel.challenge.challenger),
      targetScore: activeDuel.challenge.challenger_score,
    };
  }, [activeDuel]);

  const handleDuelMatchFinished = useCallback(
    async (finalScore: number): Promise<string | null> => {
      if (!user?.id || !activeDuel) return null;

      if (activeDuel.kind === 'create') {
        await createArcadeChallenge({
          gameId: activeDuel.gameId,
          challengerId: user.id,
          challengedId: activeDuel.opponent.id,
          challengerScore: finalScore,
        });
        void loadChallenges();
        return `¡Reto enviado a ${getAuthorDisplayName(activeDuel.opponent)} con ${finalScore.toLocaleString('es-ES')} pts!`;
      }

      const target = activeDuel.challenge.challenger_score;
      const challengerName = getAuthorDisplayName(
        activeDuel.challenge.challenger
      );
      await completeArcadeChallenge({
        challengeId: activeDuel.challenge.id,
        challengedId: user.id,
        challengedScore: finalScore,
      });
      void loadChallenges();

      if (finalScore > target) {
        return `¡Ganaste el duelo contra ${challengerName}! (${finalScore.toLocaleString('es-ES')} vs ${target.toLocaleString('es-ES')} pts)`;
      }
      if (finalScore === target) {
        return `¡Empate contra ${challengerName}! (${finalScore.toLocaleString('es-ES')} pts cada uno)`;
      }
      return `Duelo completado · Ganó ${challengerName} (${target.toLocaleString('es-ES')} vs ${finalScore.toLocaleString('es-ES')} pts)`;
    },
    [user?.id, activeDuel, loadChallenges]
  );

  const refreshHighScores = useCallback(() => {
    setHighScores(getArcadeHighScores());
    setDailyTodayBest((prev) =>
      Math.max(
        prev,
        getLocalDailyChallengeBest(dailyChallenge.dateKey, dailyChallenge.gameId)
      )
    );
    setBoardRefreshKey((prev) => prev + 1);
  }, [dailyChallenge.dateKey, dailyChallenge.gameId]);

  useEffect(() => {
    setGames(loadArcadeGames());
    setHighScores(getArcadeHighScores());
  }, []);

  // Sincroniza Mis Récords y el avance del Reto Diario desde Supabase
  useEffect(() => {
    const localDaily = getLocalDailyChallengeBest(
      dailyChallenge.dateKey,
      dailyChallenge.gameId
    );
    if (!user?.id) {
      setRemoteRecords({});
      setDailyTodayBest(localDaily);
      return;
    }

    let active = true;
    Promise.all([
      fetchUserArcadeRecords(user.id).catch(() => ({})),
      fetchTodayBestScoreForGame(
        user.id,
        dailyChallenge.gameId,
        getTodayStartIso()
      ).catch(() => 0),
    ]).then(([recordsMap, todayRemoteBest]) => {
      if (!active) return;
      setRemoteRecords(recordsMap);
      setDailyTodayBest(Math.max(localDaily, todayRemoteBest));
    });

    return () => {
      active = false;
    };
  }, [user?.id, boardRefreshKey, dailyChallenge.dateKey, dailyChallenge.gameId]);

  const mergedHighScores = useMemo(() => {
    const combined: Record<string, number> = { ...highScores };
    for (const [gameId, score] of Object.entries(remoteRecords)) {
      combined[gameId] = Math.max(combined[gameId] ?? 0, score);
    }
    return combined;
  }, [highScores, remoteRecords]);

  const visibleGames = isOwner ? games : games.filter((g) => !g.isHidden);
  const featuredGame = visibleGames.find((g) => g.isFeatured) ?? null;
  const catalogGames = featuredGame
    ? visibleGames.filter((g) => g.id !== featuredGame.id)
    : visibleGames;

  const dailyChallengeGame =
    visibleGames.find((g) => g.id === dailyChallenge.gameId) ??
    games.find((g) => g.id === dailyChallenge.gameId) ??
    visibleGames[0] ??
    null;
  const dailyProgressPct = Math.min(
    100,
    Math.round((dailyTodayBest / Math.max(1, dailyChallenge.targetScore)) * 100)
  );
  const isDailyCompleted = dailyTodayBest >= dailyChallenge.targetScore;

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
        const entries = await fetchArcadeLeaderboard(
          selectedBoardGameId,
          10,
          boardPeriod
        );
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
  }, [selectedBoardGameId, boardPeriod, boardRefreshKey]);

  async function handleDeleteScore(
    scoreId: string,
    source: 'arcade_scores' | 'arcade_score_logs'
  ) {
    if (!isOwner || deletingScoreId) return;
    setDeletingScoreId(scoreId);
    setBoardError(null);
    try {
      await deleteArcadeScore(scoreId, source);
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
      <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            id="arcade-heading"
            className="font-display text-3xl font-bold tracking-tight text-[var(--text-main)] sm:text-4xl"
          >
            Arcade
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Minijuegos retro-fantasía jugables al instante desde tu navegador o celular.
          </p>
        </div>

        {ENABLE_AI_FEATURES && isOwner && (
          <button
            type="button"
            onClick={() => {
              setCreatorError(null);
              setIsCreatorOpen(true);
            }}
            className="min-h-[44px] self-start sm:self-auto inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/14 px-4 py-2 text-sm font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-500/22 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Crown size={16} aria-hidden="true" />
            <span>Crear desafío con IA</span>
          </button>
        )}
      </div>

      {/* Pestañas internas del Arcade (Oficiales, Retos 1v1, Arcade de la Comunidad) */}
      <div
        role="tablist"
        aria-label="Secciones de Arcade"
        className="no-scrollbar mt-5 flex items-center gap-2 overflow-x-auto pb-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={sectionTab === 'oficiales'}
          onClick={() => setSectionTab('oficiales')}
          className={`min-h-[42px] inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
            sectionTab === 'oficiales'
              ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
              : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
          }`}
        >
          <Gamepad2 size={15} aria-hidden="true" />
          <span>Oficiales y Rankings</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={sectionTab === 'retos'}
          onClick={() => setSectionTab('retos')}
          className={`min-h-[42px] inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
            sectionTab === 'retos'
              ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
              : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
          }`}
        >
          <Swords size={15} aria-hidden="true" />
          <span>Retos 1v1</span>
          {pendingIncomingChallengesCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--accent-primary)] px-1.5 text-[10px] font-bold text-[var(--accent-fg)] tabular-nums">
              {pendingIncomingChallengesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={sectionTab === 'comunidad'}
          onClick={() => setSectionTab('comunidad')}
          className={`min-h-[42px] inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
            sectionTab === 'comunidad'
              ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
              : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
          }`}
        >
          <Code2 size={15} aria-hidden="true" />
          <span>Arcade de la Comunidad</span>
        </button>
      </div>

      {sectionTab === 'retos' ? (
        <ArcadeChallengesPanel
          challenges={challenges}
          isLoading={isLoadingChallenges}
          errorMsg={challengesError}
          onRefresh={() => void loadChallenges()}
          onOpenAuth={() => onOpenAuth?.()}
          onLaunchCreateDuel={handleLaunchCreateDuel}
          onLaunchAcceptDuel={handleLaunchAcceptDuel}
        />
      ) : sectionTab === 'comunidad' ? (
        <CommunityArcadePanel onOpenAuth={() => onOpenAuth?.()} />
      ) : (
        <>
          {/* Reto del Día + Mis Récords personales */}
          <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Tarjeta destacada: Reto del Día */}
        <div
          aria-labelledby="daily-challenge-heading"
          className={`trama-card-glow flex flex-col justify-between rounded-2xl border bg-[var(--bg-card)] p-5 sm:p-6 shadow-sm lg:col-span-7 ${
            isDailyCompleted
              ? 'border-emerald-500/45'
              : 'border-[var(--accent-border)]'
          }`}
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 font-bold text-[var(--accent-primary)]">
                  <Target size={14} aria-hidden="true" />
                  <span>Reto del Día</span>
                </span>
                <span aria-hidden="true" className="text-[var(--text-muted)]">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
                  <Calendar size={12} aria-hidden="true" />
                  <span>{dailyChallenge.dateLabel}</span>
                </span>
              </div>

              {isDailyCompleted ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-300">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  <span>Completado hoy</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-300">
                  <Flame size={13} aria-hidden="true" />
                  <span>Activo hoy</span>
                </span>
              )}
            </div>

            <h2
              id="daily-challenge-heading"
              className="mt-2 font-display text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl"
            >
              {dailyChallenge.title}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {dailyChallenge.description}
            </p>

            {/* Barra de progreso del reto diario */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="text-[var(--text-secondary)]">
                  Mejor marca de hoy en{' '}
                  <strong className="text-[var(--text-main)]">
                    {dailyChallenge.gameTitle}
                  </strong>
                </span>
                <span className="font-bold text-[var(--text-main)]">
                  {dailyTodayBest.toLocaleString('es-ES')} /{' '}
                  {dailyChallenge.targetScore.toLocaleString('es-ES')} pts (
                  {dailyProgressPct}%)
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                <div
                  style={{
                    transform: `scaleX(${dailyProgressPct / 100})`,
                    transformOrigin: 'left center',
                  }}
                  className={`h-full w-full rounded-full transition-transform duration-500 ease-out ${
                    isDailyCompleted
                      ? 'bg-emerald-500'
                      : 'bg-[var(--accent-primary)]'
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-muted)]">
              {isDailyCompleted
                ? '¡Objetivo cumplido! Mañana rotará automáticamente un nuevo reto.'
                : 'Supera la meta hoy para desbloquear la medalla Reto Diario Superado.'}
            </p>

            {dailyChallengeGame && (
              <button
                type="button"
                onClick={() => setActiveGame(dailyChallengeGame)}
                className="trama-btn-primary min-h-[42px] inline-flex items-center gap-2 rounded-xl px-4 text-xs font-bold whitespace-nowrap"
              >
                <Play size={14} className="fill-current" aria-hidden="true" />
                <span>
                  {isDailyCompleted ? 'Volver a jugar' : 'Jugar reto'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Tarjeta personal: Mis Récords por juego */}
        <div
          aria-labelledby="my-arcade-records-heading"
          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-sm transition-colors duration-300 lg:col-span-5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/12 text-amber-600 dark:text-amber-300">
                <Medal size={16} aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="my-arcade-records-heading"
                  className="font-display text-lg font-bold tracking-tight text-[var(--text-main)]"
                >
                  Mis Récords
                </h2>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {user
                    ? 'Sincronizados con tu cuenta'
                    : 'Guardados en este dispositivo'}
                </p>
              </div>
            </div>
          </div>

          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {visibleGames.slice(0, 6).map((game) => {
              const best = mergedHighScores[game.id] ?? 0;
              return (
                <li
                  key={game.id}
                  className="flex items-center justify-between gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--text-main)]">
                      {game.title}
                    </p>
                    <p className="truncate text-[10px] text-[var(--text-muted)]">
                      {game.genre}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-display text-xs font-bold tabular-nums text-[var(--text-main)]">
                      {best.toLocaleString('es-ES')}{' '}
                      <span className="text-[10px] font-normal text-[var(--text-muted)]">
                        pts
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveGame(game)}
                      aria-label={`Jugar ${game.title}`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--accent-primary)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] transition-colors"
                    >
                      <Play size={11} className="fill-current" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Juego destacado arriba */}
      {featuredGame && (
        <article className="trama-card-glow mt-7 overflow-hidden rounded-2xl border border-[var(--accent-border)] bg-[var(--bg-card)] shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <div className="h-full [&>div]:h-full [&>div]:min-h-[220px] [&>div]:border-b lg:[&>div]:border-b-0 lg:[&>div]:border-r">
                <GamePreviewArtwork game={featuredGame} />
              </div>
            </div>

            <div className="flex flex-col justify-between p-6 sm:p-7 lg:col-span-6">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                    <Star size={13} className="fill-current" aria-hidden="true" />
                    <span>Destacado del Arcade</span>
                  </span>
                  <span aria-hidden="true" className="text-[var(--text-muted)]">
                    ·
                  </span>
                  <span className="font-semibold text-[var(--accent-primary)]">
                    {featuredGame.genre}
                  </span>
                  <span aria-hidden="true" className="text-[var(--text-muted)]">
                    ·
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {formatDifficultyLabel(featuredGame.difficulty)}
                  </span>
                </div>

                <h2 className="mt-2.5 font-display text-2xl font-bold tracking-tight text-[var(--text-main)] sm:text-3xl">
                  {featuredGame.title}
                </h2>
                <p className="reading-prose-compact mt-2.5 text-[var(--text-secondary)]">
                  {featuredGame.lore}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-main)]">
                    <Trophy size={14} className="text-amber-600 dark:text-amber-300" aria-hidden="true" />
                    <span>
                      Récord:{' '}
                      <strong className="tabular-nums text-[var(--text-main)]">
                        {(mergedHighScores[featuredGame.id] ?? 0).toLocaleString('es-ES')}
                      </strong>
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-[var(--text-muted)]">
                    ·
                  </span>
                  <span>{featuredGame.controlsHint}</span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveGame(featuredGame)}
                  className="trama-btn-primary min-h-[46px] inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold"
                >
                  <Play size={16} className="fill-current" aria-hidden="true" />
                  <span>Jugar ahora</span>
                </button>

                {isOwner && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleToggleFeatured(featuredGame.id)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 transition-colors"
                    >
                      <Star size={14} aria-hidden="true" />
                      <span>Quitar destacado</span>
                    </button>

                    {!featuredGame.isBuiltIn && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustom(featuredGame.id)}
                        className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:border-red-500/35 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 transition-colors"
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
          <h2 className="font-display text-xl font-bold tracking-tight text-[var(--text-main)]">
            Catálogo de minijuegos
          </h2>
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {visibleGames.length}{' '}
            {visibleGames.length === 1 ? 'juego' : 'juegos'}
          </span>
        </div>

        {catalogGames.length === 0 && !featuredGame ? (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-10 text-center transition-colors duration-300">
            <Gamepad2 size={28} className="mx-auto text-[var(--accent-primary)]" aria-hidden="true" />
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              No hay minijuegos visibles en este momento.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {catalogGames.map((game) => (
              <article
                key={game.id}
                className={`trama-card-glow overflow-hidden rounded-2xl border bg-[var(--bg-card)] shadow-sm ${
                  game.isHidden
                    ? 'border-dashed border-[var(--border-subtle)] opacity-65'
                    : 'border-[var(--border-subtle)]'
                }`}
              >
                <GamePreviewArtwork game={game} />

                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--accent-primary)]">
                        {game.genre}
                      </span>
                      <span aria-hidden="true" className="text-[var(--text-muted)]">
                        ·
                      </span>
                      <span className="text-[var(--text-secondary)]">
                        {formatDifficultyLabel(game.difficulty)}
                      </span>
                      {game.createdByOwner && (
                        <>
                          <span aria-hidden="true" className="text-[var(--text-muted)]">
                            ·
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                            <Sparkles size={11} aria-hidden="true" />
                            <span>Edición Dueño</span>
                          </span>
                        </>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1 text-[var(--text-main)] tabular-nums">
                      <Trophy size={13} className="text-amber-600 dark:text-amber-300" aria-hidden="true" />
                      {(mergedHighScores[game.id] ?? 0).toLocaleString('es-ES')}
                    </span>
                  </div>

                  <h3 className="mt-2 font-display text-xl font-bold text-[var(--text-main)]">
                    {game.title}
                  </h3>
                  <p className="reading-prose-compact mt-1.5 text-[var(--text-secondary)] line-clamp-2">
                    {game.lore}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveGame(game)}
                      className="trama-btn-primary min-h-[44px] inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold"
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
                          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:border-amber-500/40 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                        >
                          <Star size={14} aria-hidden="true" />
                          <span>Destacar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleHidden(game.id)}
                          title={game.isHidden ? 'Mostrar en catálogo' : 'Ocultar a lectores'}
                          aria-label={game.isHidden ? 'Mostrar juego' : 'Ocultar juego'}
                          className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors"
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
                            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-red-500/35 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 transition-colors"
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
        className="mt-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-sm transition-colors duration-300 sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300">
              <Trophy size={18} aria-hidden="true" />
            </div>
            <div>
              <h2
                id="arcade-leaderboard-heading"
                className="font-display text-xl font-bold tracking-tight text-[var(--text-main)]"
              >
                Top 10 Global
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Mejores puntajes verificados de la comunidad de Trama.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setBoardRefreshKey((prev) => prev + 1)}
            disabled={isLoadingBoard}
            aria-label="Actualizar tabla de récords"
            className="min-h-[40px] self-start sm:self-auto inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              size={14}
              className={isLoadingBoard ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Filtro por periodo (Esta semana, Este mes, Histórico) y por minijuego */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {visibleGames.length > 0 && (
            <div
              role="tablist"
              aria-label="Filtrar Top 10 por juego"
              className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                    className={`min-h-[38px] shrink-0 rounded-xl border px-3.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {game.title}
                  </button>
                );
              })}
            </div>
          )}

          <div
            role="tablist"
            aria-label="Filtrar clasificación por periodo"
            className="inline-flex self-start sm:self-auto shrink-0 items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1"
          >
            {(
              [
                { id: 'week', label: 'Esta semana' },
                { id: 'month', label: 'Este mes' },
                { id: 'all', label: 'Histórico' },
              ] as const
            ).map((periodOpt) => {
              const isSelected = boardPeriod === periodOpt.id;
              return (
                <button
                  key={periodOpt.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setBoardPeriod(periodOpt.id)}
                  className={`min-h-[34px] rounded-lg px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-[var(--bg-card)] text-[var(--accent-primary)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {periodOpt.label}
                </button>
              );
            })}
          </div>
        </div>

        {boardError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-200"
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500 dark:text-red-400" aria-hidden="true" />
            <span>{boardError}</span>
          </div>
        )}

        <div className="mt-4">
          {isLoadingBoard ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-14 rounded-xl bg-[var(--bg-subtle)]" />
              <div className="h-14 rounded-xl bg-[var(--bg-subtle)]" />
              <div className="h-14 rounded-xl bg-[var(--bg-subtle)]" />
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-8 text-center">
              <Trophy size={24} className="mx-auto text-[var(--text-muted)]" aria-hidden="true" />
              <p className="mt-2.5 text-sm font-medium text-[var(--text-main)]">
                {boardPeriod === 'week'
                  ? 'Aún no hay partidas registradas esta semana'
                  : boardPeriod === 'month'
                    ? 'Aún no hay partidas registradas este mes'
                    : 'Aún no hay récords registrados en este minijuego'}
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
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
                    ? 'border-amber-500/50 bg-amber-500/18 text-amber-800 dark:text-amber-200'
                    : rank === 2
                      ? 'border-slate-400/45 bg-slate-400/15 text-slate-700 dark:text-slate-200'
                      : rank === 3
                        ? 'border-orange-500/45 bg-orange-500/15 text-orange-800 dark:text-orange-200'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]';

                return (
                  <li
                    key={entry.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                      isCurrentUser
                        ? 'border-[var(--accent-border)] bg-[var(--accent-soft)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)]'
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
                          <span className="truncate text-sm font-semibold text-[var(--text-main)]">
                            {playerName}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[11px] font-semibold text-[var(--accent-primary)]">
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
                        <span className="font-display text-base font-bold tabular-nums text-[var(--text-main)]">
                          {entry.score.toLocaleString('es-ES')}
                        </span>
                        <span className="ml-1 text-[11px] text-[var(--text-muted)]">
                          pts
                        </span>
                      </div>

                      {isOwner && (
                        isConfirming ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() =>
                                void handleDeleteScore(entry.id, entry.source)
                              }
                              className="min-h-[34px] rounded-lg bg-red-600 px-2.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                            >
                              {isDeleting ? 'Borrando…' : 'Confirmar'}
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => setConfirmDeleteScoreId(null)}
                              className="min-h-[34px] rounded-lg border border-[var(--border-subtle)] px-2 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors"
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
                            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-red-500/35 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 transition-colors"
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
        </>
      )}

      {/* Modal de juego HTML5 Canvas */}
      <ArcadeGameModal
        game={activeGame}
        challengeMode={activeChallengeMode}
        onMatchFinished={activeDuel ? handleDuelMatchFinished : undefined}
        onClose={() => {
          setActiveGame(null);
          setActiveDuel(null);
        }}
        onHighScoreUpdated={refreshHighScores}
      />

      {/* Modal exclusivo del Dueño: generar desafío con Gemini gratuito */}
      {ENABLE_AI_FEATURES && isOwner && isCreatorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcade-creator-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-amber-500/35 bg-[var(--bg-card)] p-6 shadow-2xl transition-colors duration-300">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <Crown size={14} aria-hidden="true" />
                  <span>Control exclusivo del Dueño</span>
                </div>
                <h2
                  id="arcade-creator-title"
                  className="mt-1 font-display text-xl font-bold text-[var(--text-main)]"
                >
                  Crear desafío Arcade con IA
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatorOpen(false)}
                aria-label="Cerrar"
                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleGenerateChallenge} className="mt-5 space-y-4">
              <div>
                <span className="mb-2 block text-xs font-medium text-[var(--text-main)]">
                  Modo de juego base
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedEngine('astral')}
                    className={`min-h-[44px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
                      selectedEngine === 'astral'
                        ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    Senda Astral (Esquiva)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedEngine('bastion')}
                    className={`min-h-[44px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
                      selectedEngine === 'bastion'
                        ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    Bastión (Defensa)
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="arcade-ai-prompt"
                  className="mb-1.5 block text-xs font-medium text-[var(--text-main)]"
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
                  className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                />
              </div>

              {creatorError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-500/35 bg-red-500/12 px-3 py-2.5 text-xs text-red-700 dark:text-red-100"
                >
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500 dark:text-red-400" aria-hidden="true" />
                  <span>{creatorError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setIsCreatorOpen(false)}
                  className="min-h-[44px] rounded-xl px-4 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)]"
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
