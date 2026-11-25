import type { AiArcadeChallenge } from './ai';

export type ArcadeEngineId = 'astral' | 'bastion';
export type ArcadeDifficulty = 'normal' | 'dificil' | 'extremo';

export interface ArcadeGamePalette {
  bg: string;
  primary: string;
  accent: string;
  danger: string;
}

export interface ArcadeGameConfig {
  id: string;
  title: string;
  subtitle: string;
  lore: string;
  genre: string;
  engine: ArcadeEngineId;
  difficulty: ArcadeDifficulty;
  controlsHint: string;
  palette: ArcadeGamePalette;
  speedMultiplier: number;
  spawnMultiplier: number;
  playerTitle: string;
  enemyTitle: string;
  isBuiltIn: boolean;
  isFeatured: boolean;
  isHidden: boolean;
  createdByOwner?: boolean;
  createdAt: string;
}

const CATALOG_STORAGE_KEY = 'trama_arcade_catalog_state_v1';
const HIGH_SCORES_STORAGE_KEY = 'trama_arcade_highscores_v1';

export const BUILTIN_ARCADE_GAMES: ArcadeGameConfig[] = [
  {
    id: 'senda-astral',
    title: 'Senda Astral',
    subtitle: 'Esquiva meteoros y captura runas de éter',
    lore: 'Cruza el corredor de obsidiana guiando un prisma arcano. Encadena reliquias doradas para multiplicar tu puntuación y usa el impulso astral para atravesar rayos del vacío.',
    genre: 'Acción · Esquiva',
    engine: 'astral',
    difficulty: 'normal',
    controlsHint: '← → / A D o desliza · Espacio o botón Impulso',
    palette: {
      bg: '#080B12',
      primary: '#388BFF',
      accent: '#FBBF24',
      danger: '#F43F5E',
    },
    speedMultiplier: 1,
    spawnMultiplier: 1,
    playerTitle: 'Prisma Astral',
    enemyTitle: 'Meteoros del Vacío',
    isBuiltIn: true,
    isFeatured: true,
    isHidden: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'bastion-de-runas',
    title: 'Bastión de Runas',
    subtitle: 'Defiende la ciudadela contra oleadas espectrales',
    lore: 'Mantén en pie el cristal del bastión disparando haces rúnicos contra espectros, cazadores y gólems blindados. Recoge sellos de triple disparo y libera el Pulso Nova cuando el cielo se cierre.',
    genre: 'Arcade · Defensa',
    engine: 'bastion',
    difficulty: 'dificil',
    controlsHint: '← → / A D o desliza · Disparo automático · Espacio: Nova',
    palette: {
      bg: '#0B0914',
      primary: '#F59E0B',
      accent: '#34D399',
      danger: '#EC4899',
    },
    speedMultiplier: 1,
    spawnMultiplier: 1,
    playerTitle: 'Centinela Rúnico',
    enemyTitle: 'Legión Espectral',
    isBuiltIn: true,
    isFeatured: false,
    isHidden: false,
    createdAt: '2026-01-02T00:00:00.000Z',
  },
];

interface StoredArcadeState {
  featuredId: string | null;
  hiddenIds: string[];
  customGames: ArcadeGameConfig[];
}

function readStoredCatalogState(): StoredArcadeState {
  try {
    const raw = window.localStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) {
      return {
        featuredId: 'senda-astral',
        hiddenIds: [],
        customGames: [],
      };
    }
    const parsed = JSON.parse(raw) as Partial<StoredArcadeState>;
    return {
      featuredId:
        typeof parsed.featuredId === 'string' ? parsed.featuredId : null,
      hiddenIds: Array.isArray(parsed.hiddenIds)
        ? parsed.hiddenIds.filter((id): id is string => typeof id === 'string')
        : [],
      customGames: Array.isArray(parsed.customGames)
        ? parsed.customGames
        : [],
    };
  } catch {
    return {
      featuredId: 'senda-astral',
      hiddenIds: [],
      customGames: [],
    };
  }
}

function writeStoredCatalogState(state: StoredArcadeState): void {
  try {
    window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignorar errores de cuota de almacenamiento local
  }
}

export function loadArcadeGames(): ArcadeGameConfig[] {
  const stored = readStoredCatalogState();
  const hiddenSet = new Set(stored.hiddenIds);

  const merged = [...BUILTIN_ARCADE_GAMES, ...stored.customGames].map(
    (game) => ({
      ...game,
      isFeatured: stored.featuredId === game.id,
      isHidden: hiddenSet.has(game.id),
    })
  );

  return merged.sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    return 0;
  });
}

export function setFeaturedArcadeGame(gameId: string | null): ArcadeGameConfig[] {
  const stored = readStoredCatalogState();
  stored.featuredId = stored.featuredId === gameId ? null : gameId;
  writeStoredCatalogState(stored);
  return loadArcadeGames();
}

export function toggleHiddenArcadeGame(gameId: string): ArcadeGameConfig[] {
  const stored = readStoredCatalogState();
  const set = new Set(stored.hiddenIds);
  if (set.has(gameId)) {
    set.delete(gameId);
  } else {
    set.add(gameId);
    if (stored.featuredId === gameId) {
      stored.featuredId = null;
    }
  }
  stored.hiddenIds = Array.from(set);
  writeStoredCatalogState(stored);
  return loadArcadeGames();
}

export function addCustomArcadeChallenge(
  challenge: AiArcadeChallenge
): ArcadeGameConfig[] {
  const stored = readStoredCatalogState();
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const newGame: ArcadeGameConfig = {
    id,
    title: challenge.title,
    subtitle: challenge.subtitle,
    lore: challenge.lore,
    genre:
      challenge.baseEngine === 'astral'
        ? 'Desafío · Esquiva'
        : 'Desafío · Defensa',
    engine: challenge.baseEngine,
    difficulty: challenge.difficulty,
    controlsHint:
      challenge.baseEngine === 'astral'
        ? '← → / A D o desliza · Espacio o botón Impulso'
        : '← → / A D o desliza · Disparo automático · Espacio: Nova',
    palette: challenge.palette,
    speedMultiplier: challenge.speedMultiplier,
    spawnMultiplier: challenge.spawnMultiplier,
    playerTitle: challenge.playerTitle,
    enemyTitle: challenge.enemyTitle,
    isBuiltIn: false,
    isFeatured: true,
    isHidden: false,
    createdByOwner: true,
    createdAt: new Date().toISOString(),
  };

  stored.customGames = [newGame, ...stored.customGames];
  stored.featuredId = id;
  writeStoredCatalogState(stored);
  return loadArcadeGames();
}

export function deleteCustomArcadeChallenge(gameId: string): ArcadeGameConfig[] {
  const stored = readStoredCatalogState();
  stored.customGames = stored.customGames.filter((g) => g.id !== gameId);
  stored.hiddenIds = stored.hiddenIds.filter((id) => id !== gameId);
  if (stored.featuredId === gameId) {
    stored.featuredId = BUILTIN_ARCADE_GAMES[0].id;
  }
  writeStoredCatalogState(stored);
  return loadArcadeGames();
}

export function getArcadeHighScores(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(HIGH_SCORES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const scores: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const num = Number(value);
      if (Number.isFinite(num) && num >= 0) {
        scores[key] = Math.floor(num);
      }
    }
    return scores;
  } catch {
    return {};
  }
}

export function saveArcadeHighScore(gameId: string, score: number): boolean {
  const cleanScore = Math.max(0, Math.floor(score));
  const scores = getArcadeHighScores();
  const prev = scores[gameId] ?? 0;
  if (cleanScore <= prev) return false;
  scores[gameId] = cleanScore;
  try {
    window.localStorage.setItem(HIGH_SCORES_STORAGE_KEY, JSON.stringify(scores));
  } catch {
    // Ignorar error de almacenamiento
  }
  return true;
}

export function formatDifficultyLabel(diff: ArcadeDifficulty): string {
  if (diff === 'extremo') return 'Extremo';
  if (diff === 'dificil') return 'Difícil';
  return 'Normal';
}
