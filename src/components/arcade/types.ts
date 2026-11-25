import type { DifficultyPreset } from '../../lib/arcade';
import type { RetroSynth } from '../../lib/arcadeSound';

export interface MiniGameHudUpdate {
  score: number;
  lives: number;
  maxLives: number;
  stageLabel: string;
  combo: number;
  statusLabel?: string | null;
}

export interface MiniGameEngineProps {
  difficulty: DifficultyPreset;
  paused: boolean;
  runKey: number;
  accentHex: string;
  synth: RetroSynth;
  onHudUpdate: (hud: MiniGameHudUpdate) => void;
  onGameOver: (rawScore: number, summaryNote?: string) => void;
}
