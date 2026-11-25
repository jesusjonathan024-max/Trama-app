import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import {
  formatDifficultyLabel,
  getArcadeHighScores,
  saveArcadeHighScore,
  type ArcadeGameConfig,
} from '../lib/arcade';

interface ArcadeGameModalProps {
  game: ArcadeGameConfig | null;
  onClose: () => void;
  onHighScoreUpdated: () => void;
}

type GamePhase = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

interface HudSnapshot {
  score: number;
  lives: number;
  maxLives: number;
  wave: number;
  combo: number;
  charge: number; // 0..100 (Impulso or Nova)
  powerupLabel: string | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  alpha: number;
}

interface AstralHazard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rot: number;
  rotSpeed: number;
}

interface AstralRelic {
  x: number;
  y: number;
  vy: number;
  radius: number;
  kind: 'rune' | 'shield';
  pulse: number;
}

interface VoidBeam {
  x: number;
  width: number;
  timer: number; // > 0 warning, <= 0 active until -0.45
  hitDone: boolean;
}

interface BastionBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

interface BastionEnemy {
  x: number;
  y: number;
  baseX: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  kind: 'wraith' | 'hunter' | 'golem';
  phase: number;
  flash: number;
}

interface BastionDrop {
  x: number;
  y: number;
  vy: number;
  kind: 'triple' | 'rapid' | 'heal';
}

interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

class RetroSynth {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    volume = 0.08,
    endFreq?: number
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(40, endFreq),
          now + duration
        );
      }
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.01);
    } catch {
      // Silenciar fallos de Web Audio en navegadores restringidos
    }
  }

  public pickup(combo: number) {
    const base = 440 + Math.min(combo, 6) * 65;
    this.tone(base, 0.09, 'triangle', 0.09, base * 1.35);
  }

  public shoot() {
    this.tone(620, 0.045, 'square', 0.03, 320);
  }

  public hitEnemy(isBoss = false) {
    this.tone(isBoss ? 180 : 280, isBoss ? 0.14 : 0.07, 'sawtooth', 0.07, 90);
  }

  public damage() {
    this.tone(160, 0.22, 'sawtooth', 0.11, 55);
  }

  public ability() {
    this.tone(360, 0.12, 'sine', 0.1, 880);
    setTimeout(() => this.tone(540, 0.16, 'triangle', 0.08, 1080), 55);
  }

  public gameOver() {
    this.tone(320, 0.16, 'triangle', 0.09, 240);
    setTimeout(() => this.tone(220, 0.28, 'sawtooth', 0.08, 95), 140);
  }
}

function GameEmblemSvg({ game }: { game: ArcadeGameConfig }) {
  const { primary, accent, danger } = game.palette;
  if (game.engine === 'bastion') {
    return (
      <svg
        width="76"
        height="76"
        viewBox="0 0 76 76"
        fill="none"
        aria-hidden="true"
        className="mx-auto"
      >
        <polygon
          points="38,6 64,20 64,52 38,70 12,52 12,20"
          stroke={primary}
          strokeWidth="2.5"
          fill={`${primary}18`}
        />
        <polygon
          points="38,16 54,28 48,54 28,54 22,28"
          stroke={accent}
          strokeWidth="2"
          fill={`${accent}14`}
        />
        <circle cx="38" cy="36" r="8" fill={primary} />
        <path
          d="M38 10V22M20 46L30 40M56 46L46 40"
          stroke={danger}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      width="76"
      height="76"
      viewBox="0 0 76 76"
      fill="none"
      aria-hidden="true"
      className="mx-auto"
    >
      <circle
        cx="38"
        cy="38"
        r="31"
        stroke={primary}
        strokeWidth="2"
        strokeDasharray="6 4"
        opacity="0.7"
      />
      <polygon
        points="38,10 58,44 38,36 18,44"
        fill={primary}
        stroke="#FFFFFF"
        strokeWidth="1.5"
      />
      <polygon points="38,42 46,58 38,66 30,58" fill={accent} />
      <circle cx="56" cy="22" r="5" fill={danger} />
    </svg>
  );
}

export function ArcadeGameModal({
  game,
  onClose,
  onHighScoreUpdated,
}: ArcadeGameModalProps) {
  const [phase, setPhase] = useState<GamePhase>('TITLE_MENU');
  const [muted, setMuted] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [hud, setHud] = useState<HudSnapshot>({
    score: 0,
    lives: 3,
    maxLives: 3,
    wave: 1,
    combo: 1,
    charge: 100,
    powerupLabel: null,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef<GamePhase>('TITLE_MENU');
  const synthRef = useRef<RetroSynth>(new RetroSynth());
  const keysRef = useRef<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  });
  const pointerTargetXRef = useRef<number | null>(null);
  const abilityQueuedRef = useRef<boolean>(false);

  phaseRef.current = phase;
  synthRef.current.muted = muted;

  useEffect(() => {
    if (!game) return;
    const scores = getArcadeHighScores();
    setBestScore(scores[game.id] ?? 0);
    setPhase('TITLE_MENU');
    setIsNewRecord(false);
    setHud({
      score: 0,
      lives: 3,
      maxLives: 3,
      wave: 1,
      combo: 1,
      charge: game.engine === 'astral' ? 100 : 35,
      powerupLabel: null,
    });
  }, [game]);

  const startNewRun = useCallback(() => {
    if (!game) return;
    setIsNewRecord(false);
    setPhase('PLAYING');
    setRunKey((prev) => prev + 1);
    synthRef.current.ability();
  }, [game]);

  const triggerAbility = useCallback(() => {
    if (phaseRef.current === 'PLAYING') {
      abilityQueuedRef.current = true;
    }
  }, []);

  // Controles de teclado
  useEffect(() => {
    if (!game) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (phaseRef.current === 'PLAYING') {
          setPhase('PAUSED');
        } else if (phaseRef.current === 'PAUSED') {
          setPhase('PLAYING');
        } else {
          onClose();
        }
        return;
      }

      if (event.key === 'p' || event.key === 'P') {
        if (phaseRef.current === 'PLAYING') setPhase('PAUSED');
        else if (phaseRef.current === 'PAUSED') setPhase('PLAYING');
        return;
      }

      if (
        event.key === 'ArrowLeft' ||
        event.key === 'a' ||
        event.key === 'A'
      ) {
        keysRef.current.left = true;
        pointerTargetXRef.current = null;
      } else if (
        event.key === 'ArrowRight' ||
        event.key === 'd' ||
        event.key === 'D'
      ) {
        keysRef.current.right = true;
        pointerTargetXRef.current = null;
      } else if (event.key === ' ' || event.key === 'Shift') {
        if (phaseRef.current === 'PLAYING') {
          event.preventDefault();
          abilityQueuedRef.current = true;
        } else if (
          phaseRef.current === 'TITLE_MENU' ||
          phaseRef.current === 'GAME_OVER'
        ) {
          event.preventDefault();
          startNewRun();
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (
        event.key === 'ArrowLeft' ||
        event.key === 'a' ||
        event.key === 'A'
      ) {
        keysRef.current.left = false;
      } else if (
        event.key === 'ArrowRight' ||
        event.key === 'd' ||
        event.key === 'D'
      ) {
        keysRef.current.right = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      keysRef.current = { left: false, right: false };
    };
  }, [game, onClose, startNewRun]);

  // Motor principal HTML5 Canvas (60fps, dt clamped, aislado de React)
  useEffect(() => {
    if (!game || runKey === 0) return;
    const canvas = canvasRef.current;
    const container = stageRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = Math.max(320, container.clientWidth);
    let height = Math.max(460, container.clientHeight);

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(320, Math.floor(rect.width));
      height = Math.max(460, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const { palette, speedMultiplier, spawnMultiplier, engine } = game;
    const synth = synthRef.current;

    const stars: Star[] = Array.from({ length: 54 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speed: 24 + Math.random() * 95,
      size: 1 + Math.random() * 2,
      alpha: 0.25 + Math.random() * 0.65,
    }));

    const particles: Particle[] = [];
    const floatingTexts: FloatingText[] = [];
    const shockwaves: ShockwaveRing[] = [];

    // Estado general de partida
    let elapsed = 0;
    let score = 0;
    let lives = 3;
    const maxLives = 3;
    let wave = 1;
    let combo = 1;
    let comboTimer = 0;
    let charge = engine === 'astral' ? 100 : 40;
    let invulnTimer = 0;
    let dashTimer = 0;
    let hitstopTimer = 0;
    let shakeMag = 0;
    let gridOffset = 0;
    let bannerText = `OLEADA 1`;
    let bannerTimer = 1.6;

    // Jugador
    let playerX = width / 2;
    const playerY = () => height - (engine === 'bastion' ? 74 : 92);
    const playerRadius = 17;
    const trail: Array<{ x: number; y: number; alpha: number }> = [];

    // Colecciones específicas de Senda Astral
    const hazards: AstralHazard[] = [];
    const relics: AstralRelic[] = [];
    const beams: VoidBeam[] = [];
    let hazardSpawnTimer = 0.6;
    let relicSpawnTimer = 0.9;
    let beamSpawnTimer = 6.5;

    // Colecciones específicas de Bastión de Runas
    const bullets: BastionBullet[] = [];
    const enemies: BastionEnemy[] = [];
    const drops: BastionDrop[] = [];
    let fireCooldown = 0;
    let enemySpawnTimer = 0.7;
    let tripleTimer = 0;
    let rapidTimer = 0;

    let lastHudSignature = '';
    const syncHud = () => {
      const powerupLabel =
        tripleTimer > 0
          ? `Triple ${Math.ceil(tripleTimer)}s`
          : rapidTimer > 0
            ? `Sobrecarga ${Math.ceil(rapidTimer)}s`
            : dashTimer > 0
              ? 'Impulso'
              : null;
      const roundedScore = Math.floor(score);
      const roundedCharge = Math.floor(charge);
      const sig = `${roundedScore}|${lives}|${wave}|${combo}|${roundedCharge}|${powerupLabel ?? ''}`;
      if (sig !== lastHudSignature) {
        lastHudSignature = sig;
        setHud({
          score: roundedScore,
          lives,
          maxLives,
          wave,
          combo,
          charge: roundedCharge,
          powerupLabel,
        });
      }
    };

    const spawnBurst = (
      x: number,
      y: number,
      color: string,
      count: number,
      speed = 180
    ) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const mag = speed * (0.35 + Math.random() * 0.75);
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * mag,
          vy: Math.sin(angle) * mag,
          size: 2 + Math.random() * 3.2,
          color,
          life: 0.35 + Math.random() * 0.35,
          maxLife: 0.7,
        });
      }
    };

    const spawnFloat = (x: number, y: number, text: string, color: string) => {
      floatingTexts.push({
        x,
        y,
        text,
        color,
        life: 0.85,
        maxLife: 0.85,
      });
    };

    const triggerPlayerDamage = (px: number, py: number) => {
      if (invulnTimer > 0 || dashTimer > 0) return;
      lives = Math.max(0, lives - 1);
      combo = 1;
      invulnTimer = 1.35;
      hitstopTimer = 0.045;
      shakeMag = 12;
      synth.damage();
      spawnBurst(px, py, palette.danger, 20, 230);
      spawnFloat(px, py - 24, '-1 ESCUDO', palette.danger);

      if (lives <= 0) {
        const finalScore = Math.floor(score);
        const beatRecord = saveArcadeHighScore(game.id, finalScore);
        setIsNewRecord(beatRecord);
        if (beatRecord) {
          setBestScore(finalScore);
          onHighScoreUpdated();
        }
        syncHud();
        synth.gameOver();
        setPhase('GAME_OVER');
      }
    };

    let animationId = 0;
    let lastTimestamp = performance.now();

    const frame = (now: number) => {
      animationId = window.requestAnimationFrame(frame);

      const rawDt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      if (phaseRef.current !== 'PLAYING') {
        return;
      }

      if (hitstopTimer > 0) {
        hitstopTimer = Math.max(0, hitstopTimer - dt);
        return;
      }

      elapsed += dt;
      gridOffset = (gridOffset + dt * 90 * speedMultiplier) % 44;
      shakeMag = Math.max(0, shakeMag - dt * 28);
      invulnTimer = Math.max(0, invulnTimer - dt);
      dashTimer = Math.max(0, dashTimer - dt);
      bannerTimer = Math.max(0, bannerTimer - dt);
      tripleTimer = Math.max(0, tripleTimer - dt);
      rapidTimer = Math.max(0, rapidTimer - dt);

      const nextWave = Math.floor(elapsed / 16) + 1;
      if (nextWave > wave) {
        wave = nextWave;
        bannerText = `OLEADA ${wave}`;
        bannerTimer = 1.7;
        synth.pickup(wave + 2);
      }

      const difficultyRamp = (1 + (wave - 1) * 0.12) * speedMultiplier;
      const py = playerY();

      // Movimiento del jugador (teclado o arrastre táctil)
      const moveSpeed = (engine === 'astral' ? 390 : 370) * (dashTimer > 0 ? 1.45 : 1);
      if (keysRef.current.left) {
        playerX -= moveSpeed * dt;
      }
      if (keysRef.current.right) {
        playerX += moveSpeed * dt;
      }
      if (pointerTargetXRef.current !== null) {
        const diff = pointerTargetXRef.current - playerX;
        const maxStep = moveSpeed * 1.65 * dt;
        playerX += Math.abs(diff) <= maxStep ? diff : Math.sign(diff) * maxStep;
      }
      playerX = Math.min(width - 28, Math.max(28, playerX));

      // Rastro del jugador
      if (dashTimer > 0 || Math.random() < 0.45) {
        trail.push({ x: playerX, y: py, alpha: dashTimer > 0 ? 0.8 : 0.35 });
      }
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].alpha -= dt * 2.8;
        trail[i].y += dt * 70;
        if (trail[i].alpha <= 0) trail.splice(i, 1);
      }

      // Estrellas parallax
      for (const star of stars) {
        star.y += star.speed * dt * (engine === 'astral' ? 1.35 : 0.85);
        if (star.y > height) {
          star.y = -4;
          star.x = Math.random() * width;
        }
      }

      // Habilidad especial (Impulso en Astral / Pulso Nova en Bastión)
      if (abilityQueuedRef.current) {
        abilityQueuedRef.current = false;
        if (engine === 'astral' && charge >= 50 && dashTimer <= 0) {
          charge = Math.max(0, charge - 50);
          dashTimer = 0.55;
          shakeMag = 6;
          synth.ability();
          shockwaves.push({
            x: playerX,
            y: py,
            radius: 10,
            maxRadius: 115,
            color: palette.primary,
            life: 0.35,
            maxLife: 0.35,
          });
          spawnFloat(playerX, py - 26, 'IMPULSO!', palette.primary);
        } else if (engine === 'bastion' && charge >= 100) {
          charge = 0;
          hitstopTimer = 0.04;
          shakeMag = 14;
          synth.ability();
          shockwaves.push({
            x: playerX,
            y: py,
            radius: 20,
            maxRadius: Math.max(width, height) * 0.9,
            color: palette.accent,
            life: 0.5,
            maxLife: 0.5,
          });
          spawnFloat(playerX, py - 32, 'PULSO NOVA!', palette.accent);

          for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            enemy.hp -= 5;
            enemy.flash = 0.16;
            if (enemy.hp <= 0) {
              const pts = enemy.kind === 'golem' ? 220 : 80;
              score += pts;
              spawnBurst(enemy.x, enemy.y, palette.accent, 14, 210);
              spawnFloat(enemy.x, enemy.y, `+${pts}`, palette.accent);
              enemies.splice(i, 1);
            }
          }
        }
      }

      // =========================
      // MOTOR 1: SENDA ASTRAL
      // =========================
      if (engine === 'astral') {
        score += dt * 14 * combo;
        charge = Math.min(100, charge + dt * 9);
        if (combo > 1) {
          comboTimer -= dt;
          if (comboTimer <= 0) combo = 1;
        }

        hazardSpawnTimer -= dt;
        if (hazardSpawnTimer <= 0) {
          const interval = Math.max(
            0.22,
            (0.66 - wave * 0.045) / spawnMultiplier
          );
          hazardSpawnTimer = interval * (0.75 + Math.random() * 0.5);
          const radius = 13 + Math.random() * 14;
          hazards.push({
            x: 24 + Math.random() * (width - 48),
            y: -radius - 10,
            vx: (Math.random() - 0.5) * 65 * difficultyRamp,
            vy: (185 + Math.random() * 125) * difficultyRamp,
            radius,
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 4.2,
          });
        }

        relicSpawnTimer -= dt;
        if (relicSpawnTimer <= 0) {
          relicSpawnTimer = 1.05 + Math.random() * 0.7;
          const spawnShield = lives < maxLives && Math.random() < 0.15;
          relics.push({
            x: 34 + Math.random() * (width - 68),
            y: -20,
            vy: (150 + wave * 12) * speedMultiplier,
            radius: 13,
            kind: spawnShield ? 'shield' : 'rune',
            pulse: 0,
          });
        }

        beamSpawnTimer -= dt;
        if (beamSpawnTimer <= 0 && wave >= 2) {
          beamSpawnTimer = Math.max(3.4, 7.2 - wave * 0.45);
          beams.push({
            x: 44 + Math.random() * (width - 88),
            width: 34,
            timer: 1.15,
            hitDone: false,
          });
        }

        // Actualizar meteoros
        for (let i = hazards.length - 1; i >= 0; i--) {
          const h = hazards[i];
          h.x += h.vx * dt;
          h.y += h.vy * dt;
          h.rot += h.rotSpeed * dt;
          if (h.x < h.radius || h.x > width - h.radius) {
            h.vx *= -1;
          }

          const dist = Math.hypot(h.x - playerX, h.y - py);
          if (dist < h.radius + playerRadius - 3) {
            if (dashTimer > 0) {
              // El impulso destruye meteoros con bono
              const pts = 60 * combo;
              score += pts;
              hitstopTimer = 0.025;
              shakeMag = 5;
              synth.hitEnemy(false);
              spawnBurst(h.x, h.y, palette.primary, 12, 200);
              spawnFloat(h.x, h.y, `+${pts}`, palette.primary);
              hazards.splice(i, 1);
              continue;
            } else {
              hazards.splice(i, 1);
              triggerPlayerDamage(playerX, py);
              continue;
            }
          }

          if (h.y > height + 40) {
            hazards.splice(i, 1);
          }
        }

        // Actualizar rayos del vacío
        for (let i = beams.length - 1; i >= 0; i--) {
          const b = beams[i];
          b.timer -= dt;
          if (b.timer <= 0 && b.timer > -0.42) {
            if (
              !b.hitDone &&
              Math.abs(playerX - b.x) < b.width / 2 + playerRadius - 4
            ) {
              b.hitDone = true;
              triggerPlayerDamage(playerX, py);
            }
          }
          if (b.timer <= -0.45) {
            beams.splice(i, 1);
          }
        }

        // Actualizar reliquias
        for (let i = relics.length - 1; i >= 0; i--) {
          const r = relics[i];
          r.y += r.vy * dt;
          r.pulse += dt * 6;
          const dist = Math.hypot(r.x - playerX, r.y - py);
          if (dist < r.radius + playerRadius + 4) {
            if (r.kind === 'shield') {
              lives = Math.min(maxLives, lives + 1);
              synth.ability();
              spawnBurst(r.x, r.y, '#34D399', 14, 170);
              spawnFloat(r.x, r.y, '+1 ESCUDO', '#34D399');
            } else {
              combo = Math.min(5, combo + 1);
              comboTimer = 4.2;
              const pts = 50 * combo;
              score += pts;
              charge = Math.min(100, charge + 22);
              synth.pickup(combo);
              spawnBurst(r.x, r.y, palette.accent, 10, 150);
              spawnFloat(
                r.x,
                r.y,
                combo > 1 ? `+${pts} x${combo}` : `+${pts}`,
                palette.accent
              );
            }
            relics.splice(i, 1);
            continue;
          }
          if (r.y > height + 30) {
            relics.splice(i, 1);
          }
        }
      }

      // =========================
      // MOTOR 2: BASTIÓN DE RUNAS
      // =========================
      if (engine === 'bastion') {
        fireCooldown -= dt;
        const rate = rapidTimer > 0 ? 0.11 : 0.21;
        if (fireCooldown <= 0) {
          fireCooldown = rate;
          synth.shoot();
          if (tripleTimer > 0) {
            bullets.push(
              { x: playerX, y: py - 18, vx: 0, vy: -560, color: palette.accent },
              {
                x: playerX - 8,
                y: py - 14,
                vx: -115,
                vy: -535,
                color: palette.primary,
              },
              {
                x: playerX + 8,
                y: py - 14,
                vx: 115,
                vy: -535,
                color: palette.primary,
              }
            );
          } else {
            bullets.push({
              x: playerX,
              y: py - 18,
              vx: 0,
              vy: -560,
              color: palette.primary,
            });
          }
        }

        enemySpawnTimer -= dt;
        if (enemySpawnTimer <= 0) {
          const interval = Math.max(
            0.34,
            (1.12 - wave * 0.07) / spawnMultiplier
          );
          enemySpawnTimer = interval * (0.8 + Math.random() * 0.45);
          const roll = Math.random();
          let kind: BastionEnemy['kind'] = 'wraith';
          if (wave >= 2 && roll > 0.78) kind = 'golem';
          else if (roll > 0.46) kind = 'hunter';

          const radius = kind === 'golem' ? 23 : kind === 'hunter' ? 16 : 15;
          const maxHp =
            kind === 'golem'
              ? 4 + Math.floor(wave / 2)
              : kind === 'hunter'
                ? 2
                : 1;
          const bx = 34 + Math.random() * (width - 68);
          enemies.push({
            x: bx,
            baseX: bx,
            y: -radius - 10,
            vy:
              (kind === 'golem' ? 68 : kind === 'hunter' ? 115 : 102) *
              difficultyRamp,
            radius,
            hp: maxHp,
            maxHp,
            kind,
            phase: Math.random() * Math.PI * 2,
            flash: 0,
          });
        }

        // Balas
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.y < -20 || b.x < -20 || b.x > width + 20) {
            bullets.splice(i, 1);
          }
        }

        // Enemigos y colisiones
        const barrierY = height - 34;
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          e.y += e.vy * dt;
          e.phase += dt * 3.4;
          e.flash = Math.max(0, e.flash - dt);

          if (e.kind === 'hunter') {
            e.x = Math.min(
              width - e.radius - 10,
              Math.max(e.radius + 10, e.baseX + Math.sin(e.phase) * 58)
            );
          }

          // Colisión bala-enemigo
          let destroyed = false;
          for (let j = bullets.length - 1; j >= 0; j--) {
            const b = bullets[j];
            if (Math.hypot(b.x - e.x, b.y - e.y) < e.radius + 7) {
              bullets.splice(j, 1);
              e.hp -= 1;
              e.flash = 0.1;
              spawnBurst(b.x, b.y, b.color, 4, 110);
              if (e.hp <= 0) {
                destroyed = true;
                const pts =
                  e.kind === 'golem' ? 200 : e.kind === 'hunter' ? 90 : 50;
                score += pts;
                charge = Math.min(100, charge + (e.kind === 'golem' ? 26 : 11));
                combo = Math.min(5, combo + (e.kind === 'golem' ? 1 : 0));
                if (e.kind === 'golem') {
                  hitstopTimer = 0.04;
                  shakeMag = 9;
                }
                synth.hitEnemy(e.kind === 'golem');
                spawnBurst(
                  e.x,
                  e.y,
                  e.kind === 'golem' ? palette.accent : palette.danger,
                  e.kind === 'golem' ? 18 : 10,
                  190
                );
                spawnFloat(e.x, e.y, `+${pts}`, palette.accent);

                if (e.kind === 'golem' || Math.random() < 0.14) {
                  const pRoll = Math.random();
                  drops.push({
                    x: e.x,
                    y: e.y,
                    vy: 130,
                    kind:
                      pRoll < 0.45
                        ? 'triple'
                        : pRoll < 0.8
                          ? 'rapid'
                          : 'heal',
                  });
                }
                enemies.splice(i, 1);
                break;
              } else {
                synth.hitEnemy(false);
              }
            }
          }
          if (destroyed) continue;

          // Colisión enemigo con jugador o barrera
          if (
            Math.hypot(e.x - playerX, e.y - py) < e.radius + playerRadius - 3 ||
            e.y + e.radius >= barrierY
          ) {
            enemies.splice(i, 1);
            triggerPlayerDamage(playerX, py);
          }
        }

        // Power-ups
        for (let i = drops.length - 1; i >= 0; i--) {
          const d = drops[i];
          d.y += d.vy * dt;
          if (Math.hypot(d.x - playerX, d.y - py) < playerRadius + 16) {
            if (d.kind === 'triple') {
              tripleTimer = 7.5;
              spawnFloat(d.x, d.y, 'TRIPLE DISPARO', palette.accent);
            } else if (d.kind === 'rapid') {
              rapidTimer = 7.0;
              spawnFloat(d.x, d.y, 'SOBRECARGA', '#38BDF8');
            } else {
              lives = Math.min(maxLives, lives + 1);
              spawnFloat(d.x, d.y, '+1 CRISTAL', '#34D399');
            }
            synth.pickup(4);
            spawnBurst(d.x, d.y, palette.accent, 12, 160);
            drops.splice(i, 1);
            continue;
          }
          if (d.y > height + 30) {
            drops.splice(i, 1);
          }
        }
      }

      // Actualizar partículas, textos y ondas
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y -= dt * 42;
        ft.life -= dt;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
      }

      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.life -= dt;
        const progress = 1 - Math.max(0, sw.life / sw.maxLife);
        sw.radius = sw.maxRadius * progress;
        if (sw.life <= 0) shockwaves.splice(i, 1);
      }

      // =========================
      // RENDERIZADO DEL LIENZO
      // =========================
      ctx.save();
      if (shakeMag > 0.4) {
        ctx.translate(
          (Math.random() - 0.5) * shakeMag,
          (Math.random() - 0.5) * shakeMag
        );
      }

      // Fondo base
      ctx.fillStyle = palette.bg;
      ctx.fillRect(-16, -16, width + 32, height + 32);

      // Rejilla rúnica sutil
      ctx.strokeStyle = 'rgba(255,255,255,0.038)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = gridOffset; y < height; y += 44) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Estrellas
      for (const star of stars) {
        ctx.fillStyle = `rgba(226, 232, 240, ${star.alpha})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
      }

      // Barrera del Bastión
      if (engine === 'bastion') {
        const barrierY = height - 34;
        ctx.strokeStyle = `${palette.primary}99`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(12, barrierY);
        ctx.lineTo(width - 12, barrierY);
        ctx.stroke();

        ctx.fillStyle = `${palette.primary}18`;
        ctx.fillRect(12, barrierY, width - 24, 24);
      }

      // Rayos del Vacío (Astral)
      for (const b of beams) {
        if (b.timer > 0) {
          const blink = Math.sin(b.timer * 24) > 0 ? 0.55 : 0.2;
          ctx.fillStyle = `rgba(244, 63, 94, ${blink * 0.28})`;
          ctx.fillRect(b.x - b.width / 2, 0, b.width, height);
          ctx.strokeStyle = palette.danger;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.moveTo(b.x, 0);
          ctx.lineTo(b.x, height);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.fillStyle = palette.danger;
          ctx.fillRect(b.x - b.width / 2, 0, b.width, height);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(b.x - b.width * 0.2, 0, b.width * 0.4, height);
        }
      }

      // Ondas de choque
      for (const sw of shockwaves) {
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = Math.max(0, sw.life / sw.maxLife);
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Reliquias (Astral)
      for (const r of relics) {
        const glow = 3 + Math.sin(r.pulse) * 2.5;
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.pulse * 0.35);
        ctx.fillStyle = r.kind === 'shield' ? '#34D399' : palette.accent;
        ctx.shadowColor = r.kind === 'shield' ? '#34D399' : palette.accent;
        ctx.shadowBlur = 12 + glow;
        ctx.beginPath();
        ctx.moveTo(0, -r.radius);
        ctx.lineTo(r.radius, 0);
        ctx.lineTo(0, r.radius);
        ctx.lineTo(-r.radius, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Meteoros (Astral)
      for (const h of hazards) {
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.rotate(h.rot);
        ctx.fillStyle = '#1E1420';
        ctx.strokeStyle = palette.danger;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let s = 0; s < 7; s++) {
          const ang = (Math.PI * 2 * s) / 7;
          const rad = h.radius * (s % 2 === 0 ? 1 : 0.72);
          if (s === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
          else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Balas (Bastión)
      for (const b of bullets) {
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 8;
        ctx.fillRect(b.x - 2.5, b.y - 10, 5, 16);
        ctx.shadowBlur = 0;
      }

      // Power-ups (Bastión)
      for (const d of drops) {
        const col =
          d.kind === 'triple'
            ? palette.accent
            : d.kind === 'rapid'
              ? '#38BDF8'
              : '#34D399';
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#090B0E';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          d.kind === 'triple' ? '3X' : d.kind === 'rapid' ? '⚡' : '+',
          0,
          0.5
        );
        ctx.restore();
      }

      // Enemigos (Bastión)
      for (const e of enemies) {
        ctx.save();
        ctx.translate(e.x, e.y);
        const fillCol =
          e.flash > 0
            ? '#FFFFFF'
            : e.kind === 'golem'
              ? '#261C34'
              : e.kind === 'hunter'
                ? '#2B1426'
                : '#1F1629';
        const strokeCol =
          e.kind === 'golem'
            ? palette.accent
            : e.kind === 'hunter'
              ? '#FB7185'
              : palette.danger;

        ctx.fillStyle = fillCol;
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = 2.4;

        ctx.beginPath();
        if (e.kind === 'golem') {
          for (let s = 0; s < 6; s++) {
            const ang = (Math.PI * 2 * s) / 6 - Math.PI / 2;
            const px = Math.cos(ang) * e.radius;
            const pyLocal = Math.sin(ang) * e.radius;
            if (s === 0) ctx.moveTo(px, pyLocal);
            else ctx.lineTo(px, pyLocal);
          }
        } else {
          ctx.moveTo(0, e.radius);
          ctx.lineTo(e.radius, -e.radius * 0.7);
          ctx.lineTo(0, -e.radius * 0.25);
          ctx.lineTo(-e.radius, -e.radius * 0.7);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Barra de vida para enemigos con > 1 HP
        if (e.maxHp > 1) {
          const barW = e.radius * 1.9;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(-barW / 2, -e.radius - 10, barW, 4);
          ctx.fillStyle = strokeCol;
          ctx.fillRect(-barW / 2, -e.radius - 10, barW * (e.hp / e.maxHp), 4);
        }
        ctx.restore();
      }

      // Rastro del jugador
      for (const t of trail) {
        ctx.fillStyle = palette.primary;
        ctx.globalAlpha = Math.max(0, t.alpha * 0.55);
        ctx.beginPath();
        ctx.arc(t.x, t.y + 6, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Jugador (Silueta Prisma / Centinela Arcano)
      const blinkSkip = invulnTimer > 0 && Math.floor(invulnTimer * 18) % 2 === 0;
      if (!blinkSkip) {
        ctx.save();
        ctx.translate(playerX, py);
        if (dashTimer > 0) {
          ctx.strokeStyle = palette.accent;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, playerRadius + 8, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = palette.primary;
        ctx.shadowColor = palette.primary;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, -playerRadius - 4);
        ctx.lineTo(playerRadius, playerRadius * 0.85);
        ctx.lineTo(0, playerRadius * 0.35);
        ctx.lineTo(-playerRadius, playerRadius * 0.85);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, -1, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Partículas
      for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // Textos flotantes
      ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      for (const ft of floatingTexts) {
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.globalAlpha = 1;

      // Aviso breve de oleada
      if (bannerTimer > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, bannerTimer);
        ctx.font = '800 22px "Bricolage Grotesque", sans-serif';
        ctx.fillStyle = palette.accent;
        ctx.textAlign = 'center';
        ctx.fillText(bannerText, width / 2, height * 0.34);
        ctx.restore();
      }

      ctx.restore();
      syncHud();
    };

    animationId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [game, runKey, onHighScoreUpdated]);

  if (!game) return null;

  const isAbilityReady =
    game.engine === 'astral' ? hud.charge >= 50 : hud.charge >= 100;

  function handleCanvasPointer(clientX: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    pointerTargetXRef.current = clientX - rect.left;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Juego Arcade: ${game.title}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#05070B] md:bg-black/85 md:p-5"
    >
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-[#080B12] md:h-[min(860px,92dvh)] md:max-w-[540px] md:rounded-2xl md:border md:border-white/[0.12] md:shadow-2xl">
        {/* Barra HUD superior compacta */}
        <header className="z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] bg-[#0B0F18] px-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[#8B95A5] truncate">
                {game.title}
              </p>
              <div className="flex items-center gap-2.5 text-sm font-bold tabular-nums text-white">
                <span>{hud.score.toLocaleString('es-ES')}</span>
                <span className="text-[11px] font-medium text-amber-300">
                  Ol. {hud.wave}
                </span>
                {hud.combo > 1 && (
                  <span className="text-[11px] font-semibold text-[#7FB2FF]">
                    x{hud.combo}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Vidas */}
            <div
              aria-label={`Escudos restantes: ${hud.lives}`}
              className="flex items-center gap-1 rounded-lg bg-[#121724] px-2 py-1.5"
            >
              {Array.from({ length: hud.maxLives }).map((_, idx) => (
                <Shield
                  key={idx}
                  size={14}
                  className={
                    idx < hud.lives
                      ? 'fill-emerald-400 text-emerald-400'
                      : 'text-white/15'
                  }
                  aria-hidden="true"
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setMuted((prev) => !prev)}
              aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
              className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-[#9AA4B6] hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              {muted ? (
                <VolumeX size={17} aria-hidden="true" />
              ) : (
                <Volume2 size={17} aria-hidden="true" />
              )}
            </button>

            {phase === 'PLAYING' && (
              <button
                type="button"
                onClick={() => setPhase('PAUSED')}
                aria-label="Pausar juego"
                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-[#9AA4B6] hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <Pause size={17} aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Salir del juego"
              className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-[#9AA4B6] hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Área principal del lienzo (85%+ libre) */}
        <div
          ref={stageRef}
          className="relative flex-1 w-full overflow-hidden touch-none select-none"
        >
          <canvas
            ref={canvasRef}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              handleCanvasPointer(event.clientX);
            }}
            onPointerMove={(event) => {
              if (event.buttons > 0 || event.pointerType === 'touch') {
                handleCanvasPointer(event.clientX);
              }
            }}
            onPointerUp={() => {
              pointerTargetXRef.current = null;
            }}
            onPointerCancel={() => {
              pointerTargetXRef.current = null;
            }}
            className="block h-full w-full"
          />

          {/* Indicador compacto de poder activo */}
          {phase === 'PLAYING' && hud.powerupLabel && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-[#0B0F18]/90 border border-amber-400/35 px-2.5 py-1 text-[11px] font-semibold text-amber-300 tabular-nums">
              {hud.powerupLabel}
            </div>
          )}

          {/* Botón táctil discreto de habilidad especial durante el juego */}
          {phase === 'PLAYING' && (
            <button
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
                triggerAbility();
              }}
              disabled={!isAbilityReady}
              className={`absolute bottom-4 right-4 z-10 min-h-[50px] inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-bold tracking-wide transition-all active:scale-95 ${
                isAbilityReady
                  ? 'border-amber-300/60 bg-amber-400 text-[#090B0E] shadow-lg shadow-amber-400/20'
                  : 'border-white/[0.12] bg-[#11151E]/90 text-[#8F99AB]'
              }`}
            >
              {game.engine === 'astral' ? (
                <Zap size={16} aria-hidden="true" />
              ) : (
                <Sparkles size={16} aria-hidden="true" />
              )}
              <span className="tabular-nums">
                {game.engine === 'astral' ? 'Impulso' : 'Nova'} {hud.charge}%
              </span>
            </button>
          )}

          {/* PANTALLA DE TÍTULO (TITLE_MENU) */}
          {phase === 'TITLE_MENU' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#080B12] px-6 text-center">
              <GameEmblemSvg game={game} />
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-amber-300">
                {game.genre} · {formatDifficultyLabel(game.difficulty)}
              </p>
              <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-white">
                {game.title}
              </h2>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#9AA4B6]">
                {game.lore}
              </p>

              <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#11151F] px-3.5 py-2 text-xs text-[#D5DCE6]">
                <Trophy size={14} className="text-amber-300" aria-hidden="true" />
                <span>Récord personal:</span>
                <strong className="tabular-nums text-white">
                  {bestScore.toLocaleString('es-ES')}
                </strong>
              </div>

              <button
                type="button"
                onClick={startNewRun}
                className="mt-6 min-h-[50px] min-w-[200px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#388BFF] px-7 py-3 text-base font-bold text-[#06101F] hover:bg-[#529BFF] active:scale-[0.98] transition-all"
              >
                <Play size={18} className="fill-current" aria-hidden="true" />
                <span>Jugar</span>
              </button>

              <p className="mt-5 text-xs text-[#7D879A]">
                {game.controlsHint}
              </p>
            </div>
          )}

          {/* PANTALLA DE PAUSA */}
          {phase === 'PAUSED' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#080B12]/92 px-6 text-center">
              <h3 className="font-display text-2xl font-bold text-white">
                Partida en pausa
              </h3>
              <p className="mt-1.5 text-sm text-[#9AA4B6] tabular-nums">
                Puntaje actual: {hud.score.toLocaleString('es-ES')}
              </p>
              <div className="mt-6 flex w-full max-w-xs flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => setPhase('PLAYING')}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#388BFF] px-5 text-sm font-bold text-[#06101F] hover:bg-[#529BFF] transition-colors"
                >
                  <Play size={16} className="fill-current" aria-hidden="true" />
                  <span>Continuar</span>
                </button>
                <button
                  type="button"
                  onClick={startNewRun}
                  className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-[#131823] px-5 text-sm font-medium text-white hover:bg-[#1A2130] transition-colors"
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  <span>Reiniciar partida</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] rounded-xl px-4 text-xs font-medium text-[#9AA4B6] hover:text-white transition-colors"
                >
                  Salir al Arcade
                </button>
              </div>
            </div>
          )}

          {/* PANTALLA DE FIN DE PARTIDA (GAME_OVER) */}
          {phase === 'GAME_OVER' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#080B12]/94 px-6 text-center">
              {isNewRecord && (
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-300">
                  <Trophy size={14} aria-hidden="true" />
                  <span>¡Nuevo récord personal!</span>
                </div>
              )}

              <h3 className="font-display text-3xl font-bold text-white">
                Fin de la partida
              </h3>

              <div className="mt-5 grid w-full max-w-xs grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.08] bg-[#11151F] px-3 py-3">
                  <p className="text-[11px] text-[#8B95A5]">Puntaje</p>
                  <p className="mt-1 font-display text-2xl font-bold tabular-nums text-white">
                    {hud.score.toLocaleString('es-ES')}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-[#11151F] px-3 py-3">
                  <p className="text-[11px] text-[#8B95A5]">Mejor récord</p>
                  <p className="mt-1 font-display text-2xl font-bold tabular-nums text-amber-300">
                    {Math.max(bestScore, hud.score).toLocaleString('es-ES')}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex w-full max-w-xs flex-col gap-2.5">
                <button
                  type="button"
                  onClick={startNewRun}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#388BFF] px-5 text-sm font-bold text-[#06101F] hover:bg-[#529BFF] active:scale-[0.98] transition-all"
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  <span>Jugar de nuevo</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[46px] rounded-xl border border-white/[0.1] bg-[#121621] px-5 text-sm font-medium text-[#D5DCE6] hover:bg-[#191F2E] hover:text-white transition-colors"
                >
                  Volver al Arcade
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
