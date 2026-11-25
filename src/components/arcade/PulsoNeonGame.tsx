import { useCallback, useEffect, useRef } from 'react';
import type { MiniGameEngineProps } from './types';

interface PulseNote {
  id: number;
  lane: number; // 0..3
  y: number;
  hit: boolean;
  missed: boolean;
}

interface HitBurst {
  x: number;
  y: number;
  color: string;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
}

interface JudgmentText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

const LANE_KEYS_PRIMARY = ['D', 'F', 'J', 'K'] as const;
const LANE_KEYS_ALT = ['1', '2', '3', '4'] as const;

export function PulsoNeonGame({
  difficulty,
  paused,
  runKey,
  accentHex,
  synth,
  onHudUpdate,
  onGameOver,
}: MiniGameEngineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const pausedRef = useRef(paused);
  const accentRef = useRef(accentHex);
  const onHudRef = useRef(onHudUpdate);
  const onGameOverRef = useRef(onGameOver);
  const triggerLaneRef = useRef<((lane: number) => void) | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    accentRef.current = accentHex;
  }, [accentHex]);

  useEffect(() => {
    onHudRef.current = onHudUpdate;
    onGameOverRef.current = onGameOver;
  }, [onHudUpdate, onGameOver]);

  const handlePadTrigger = useCallback((lane: number) => {
    triggerLaneRef.current?.(lane);
  }, []);

  useEffect(() => {
    if (runKey === 0) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = Math.max(300, container.clientWidth);
    let height = Math.max(360, container.clientHeight);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(300, Math.floor(rect.width));
      height = Math.max(360, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    let nextId = 1;
    const notes: PulseNote[] = [];
    const bursts: HitBurst[] = [];
    const judgments: JudgmentText[] = [];
    const laneFlash = [0, 0, 0, 0];

    const maxLives = difficulty.maxLives;
    let lives = maxLives;
    let score = 0;
    let combo = 0;
    let maxCombo = 0;
    let perfectHits = 0;
    let goodHits = 0;
    let elapsed = 0;
    let level = 1;
    let spawnTimer = 0.7;
    let beatPhase = 0;
    let finished = false;
    let lastLane = -1;

    // Ajuste de velocidad, ventana y densidad de notas dobles por dificultad
    const baseSpeed = 240 * difficulty.speedScale;
    const baseInterval =
      difficulty.id === 'facil'
        ? 0.76
        : difficulty.id === 'normal'
          ? 0.56
          : difficulty.id === 'dificil'
            ? 0.43
            : 0.35;
    const doubleChanceBase =
      difficulty.id === 'facil'
        ? 0
        : difficulty.id === 'normal'
          ? 0.14
          : difficulty.id === 'dificil'
            ? 0.3
            : 0.45;
    const perfectWindow =
      difficulty.id === 'pesadilla'
        ? 22
        : difficulty.id === 'dificil'
          ? 25
          : 30;
    const goodWindow =
      difficulty.id === 'pesadilla'
        ? 46
        : difficulty.id === 'dificil'
          ? 52
          : 60;

    let lastHudSig = '';
    const emitHud = (statusLabel?: string | null) => {
      const roundedScore = Math.floor(score);
      const sig = `${roundedScore}|${lives}|${level}|${combo}|${statusLabel ?? ''}`;
      if (sig === lastHudSig) return;
      lastHudSig = sig;
      onHudRef.current({
        score: roundedScore,
        lives,
        maxLives,
        stageLabel: `Ritmo ${level}`,
        combo,
        statusLabel: statusLabel ?? null,
      });
    };

    emitHud();

    const getHitLineY = () => Math.max(height - 76, height * 0.8);

    const getLaneColors = (): [string, string, string, string] => {
      const primary = accentRef.current || '#3B82F6';
      return [primary, '#38BDF8', '#F59E0B', '#EC4899'];
    };

    const spawnJudgment = (x: number, y: number, text: string, color: string) => {
      judgments.push({
        x,
        y,
        text,
        color,
        life: 0.65,
        maxLife: 0.65,
      });
    };

    const applyMiss = (lane: number, reason: string) => {
      if (finished) return;
      const laneW = width / 4;
      const cx = laneW * lane + laneW / 2;
      const hitY = getHitLineY();

      combo = 0;
      lives = Math.max(0, lives - difficulty.damageScale);
      synth.damage();
      spawnJudgment(cx, hitY - 22, reason, '#F43F5E');
      bursts.push({
        x: cx,
        y: hitY,
        color: '#F43F5E',
        radius: 10,
        maxRadius: 42,
        life: 0.28,
        maxLife: 0.28,
      });

      emitHud('Fallo');

      if (lives <= 0) {
        finished = true;
        onGameOverRef.current(
          Math.floor(score),
          `Racha máx. ${maxCombo} · ${perfectHits} Perfectos · ${goodHits} Bien`
        );
      }
    };

    const triggerLane = (lane: number) => {
      if (pausedRef.current || finished || lane < 0 || lane > 3) return;
      laneFlash[lane] = 1;
      const hitY = getHitLineY();
      const laneW = width / 4;
      const cx = laneW * lane + laneW / 2;
      const laneColors = getLaneColors();

      // Buscar la nota más cercana a la línea de impacto en ese carril
      let bestNote: PulseNote | null = null;
      let bestDist = Infinity;
      for (const note of notes) {
        if (note.lane !== lane || note.hit || note.missed) continue;
        const dist = Math.abs(note.y - hitY);
        if (dist < bestDist) {
          bestDist = dist;
          bestNote = note;
        }
      }

      if (bestNote && bestDist <= goodWindow) {
        bestNote.hit = true;
        combo += 1;
        if (combo > maxCombo) maxCombo = combo;
        const comboFactor = 1 + Math.min(combo, 30) * 0.08;

        if (bestDist <= perfectWindow) {
          perfectHits += 1;
          const pts = Math.round(100 * comboFactor);
          score += pts;
          synth.note(lane, true);
          spawnJudgment(cx, hitY - 26, `PERFECTO +${pts}`, '#34D399');
          bursts.push({
            x: cx,
            y: hitY,
            color: laneColors[lane],
            radius: 12,
            maxRadius: 56,
            life: 0.32,
            maxLife: 0.32,
          });
          emitHud('Perfecto');
        } else {
          goodHits += 1;
          const pts = Math.round(55 * comboFactor);
          score += pts;
          synth.note(lane, false);
          spawnJudgment(cx, hitY - 24, `BIEN +${pts}`, '#FBBF24');
          bursts.push({
            x: cx,
            y: hitY,
            color: '#FBBF24',
            radius: 10,
            maxRadius: 42,
            life: 0.25,
            maxLife: 0.25,
          });
          emitHud('Bien');
        }
      } else if (bestNote && bestDist <= goodWindow + 34) {
        // Golpe demasiado anticipado: cuenta como fallo
        bestNote.missed = true;
        applyMiss(lane, 'FALLO');
      } else {
        // Toque en vacío: retroalimentación sutil, penaliza combo en Difícil/Pesadilla
        synth.tone(190, 0.05, 'sine', 0.035, 130);
        if (difficulty.id === 'dificil' || difficulty.id === 'pesadilla') {
          combo = 0;
          spawnJudgment(cx, hitY - 20, 'SIN ONDA', '#94A3B8');
          emitHud();
        }
      }
    };

    triggerLaneRef.current = triggerLane;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (pausedRef.current || finished || event.repeat) return;
      const k = event.key.toUpperCase();
      if (k === 'D' || k === '1') {
        event.preventDefault();
        triggerLane(0);
      } else if (k === 'F' || k === '2') {
        event.preventDefault();
        triggerLane(1);
      } else if (k === 'J' || k === '3') {
        event.preventDefault();
        triggerLane(2);
      } else if (k === 'K' || k === '4') {
        event.preventDefault();
        triggerLane(3);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    let animId = 0;
    let lastTs = performance.now();

    const frame = (now: number) => {
      animId = window.requestAnimationFrame(frame);
      const dt = Math.min(Math.max((now - lastTs) / 1000, 0.001), 0.05);
      lastTs = now;

      if (pausedRef.current || finished) return;

      elapsed += dt;
      level = 1 + Math.floor(elapsed / 14);
      const speedNow = baseSpeed * (1 + Math.min(elapsed * 0.011, 0.65));
      const intervalNow = Math.max(0.22, baseInterval * Math.pow(0.955, level - 1));
      beatPhase = (beatPhase + dt * (2.2 * difficulty.speedScale)) % 1;

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTimer = intervalNow * (0.88 + Math.random() * 0.24);
        let laneA = Math.floor(Math.random() * 4);
        if (laneA === lastLane && Math.random() < 0.55) {
          laneA = (laneA + 1 + Math.floor(Math.random() * 3)) % 4;
        }
        lastLane = laneA;
        notes.push({ id: nextId++, lane: laneA, y: -22, hit: false, missed: false });

        const doubleChance = Math.min(
          0.65,
          doubleChanceBase + (level - 1) * 0.04
        );
        if (doubleChance > 0 && Math.random() < doubleChance) {
          const laneB = (laneA + 1 + Math.floor(Math.random() * 3)) % 4;
          notes.push({ id: nextId++, lane: laneB, y: -22, hit: false, missed: false });
        }
      }

      const hitY = getHitLineY();
      for (let i = notes.length - 1; i >= 0; i--) {
        const n = notes[i];
        n.y += speedNow * dt;
        if (n.hit) {
          notes.splice(i, 1);
          continue;
        }
        if (!n.missed && n.y > hitY + goodWindow + 12) {
          n.missed = true;
          applyMiss(n.lane, 'FALLO');
          if (finished) return;
        }
        if (n.y > height + 40) {
          notes.splice(i, 1);
        }
      }

      for (let i = 0; i < 4; i++) {
        laneFlash[i] = Math.max(0, laneFlash[i] - dt * 5.2);
      }

      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.life -= dt;
        b.radius = b.maxRadius * (1 - b.life / b.maxLife);
        if (b.life <= 0) bursts.splice(i, 1);
      }

      for (let i = judgments.length - 1; i >= 0; i--) {
        const j = judgments[i];
        j.y -= 42 * dt;
        j.life -= dt;
        if (j.life <= 0) judgments.splice(i, 1);
      }

      // ===================== RENDER =====================
      const laneW = width / 4;
      const laneColors = getLaneColors();

      ctx.fillStyle = '#080B13';
      ctx.fillRect(0, 0, width, height);

      // Fondo de pulsos rítmicos
      ctx.strokeStyle = 'rgba(255,255,255,0.045)';
      ctx.lineWidth = 1;
      const gridStep = 64;
      const yOffset = (elapsed * speedNow) % gridStep;
      for (let y = yOffset; y < height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Carriles + destello activo
      for (let lane = 0; lane < 4; lane++) {
        const x0 = lane * laneW;
        if (laneFlash[lane] > 0.01) {
          const grad = ctx.createLinearGradient(0, hitY - 140, 0, height);
          grad.addColorStop(0, 'rgba(255,255,255,0)');
          grad.addColorStop(1, `${laneColors[lane]}44`);
          ctx.fillStyle = grad;
          ctx.fillRect(x0, hitY - 140, laneW, height - (hitY - 140));
        }

        if (lane > 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.beginPath();
          ctx.moveTo(x0, 0);
          ctx.lineTo(x0, height);
          ctx.stroke();
        }
      }

      // Línea de impacto luminosa
      ctx.save();
      ctx.strokeStyle = accentRef.current || '#3B82F6';
      ctx.globalAlpha = 0.55 + Math.sin(beatPhase * Math.PI * 2) * 0.2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, hitY);
      ctx.lineTo(width, hitY);
      ctx.stroke();
      ctx.restore();

      // Receptores de cada carril
      for (let lane = 0; lane < 4; lane++) {
        const cx = lane * laneW + laneW / 2;
        const rx = Math.min(laneW * 0.34, 34);
        const ry = 13;
        const flash = laneFlash[lane];

        ctx.save();
        ctx.translate(cx, hitY);
        ctx.fillStyle = flash > 0.1 ? `${laneColors[lane]}40` : 'rgba(15, 20, 32, 0.9)';
        ctx.strokeStyle = laneColors[lane];
        ctx.lineWidth = 2 + flash * 1.8;
        ctx.beginPath();
        ctx.roundRect(-rx, -ry, rx * 2, ry * 2, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(LANE_KEYS_PRIMARY[lane], 0, 0.5);
        ctx.restore();
      }

      // Notas descendentes (ondas de energía)
      for (const note of notes) {
        if (note.hit) continue;
        const cx = note.lane * laneW + laneW / 2;
        const color = laneColors[note.lane];
        const rx = Math.min(laneW * 0.32, 32);
        const ry = 11;

        ctx.save();
        ctx.translate(cx, note.y);
        // Estela sutil superior
        const tailGrad = ctx.createLinearGradient(0, -34, 0, 0);
        tailGrad.addColorStop(0, 'rgba(255,255,255,0)');
        tailGrad.addColorStop(1, `${color}55`);
        ctx.fillStyle = tailGrad;
        ctx.fillRect(-rx * 0.65, -34, rx * 1.3, 34);

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.roundRect(-rx, -ry, rx * 2, ry * 2, 9);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.roundRect(-rx * 0.55, -3, rx * 1.1, 6, 3);
        ctx.fill();
        ctx.restore();
      }

      // Ondas de impacto
      for (const b of bursts) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, b.life / b.maxLife);
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Juicios flotantes (Perfecto / Bien / Fallo)
      ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      for (const j of judgments) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, j.life / j.maxLife);
        ctx.fillStyle = j.color;
        ctx.fillText(j.text, j.x, j.y);
        ctx.restore();
      }

      // Combo central translúcido si racha >= 3
      if (combo >= 3) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.font = '800 36px "Bricolage Grotesque", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${combo}x`, width / 2, height * 0.34);
        ctx.restore();
      }

      emitHud();
    };

    animId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', handleKeyDown);
      triggerLaneRef.current = null;
    };
  }, [difficulty, runKey, synth]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#080B13] select-none touch-none">
      <div
        ref={containerRef}
        className="relative flex-1 w-full overflow-hidden"
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const relX = event.clientX - rect.left;
          const lane = Math.min(3, Math.max(0, Math.floor((relX / rect.width) * 4)));
          handlePadTrigger(lane);
        }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* Botonera táctil inferior de 4 carriles para celular y clics directos */}
      <div className="grid shrink-0 grid-cols-4 gap-2 border-t border-white/[0.08] bg-[#0B0F1A] p-2.5">
        {LANE_KEYS_PRIMARY.map((keyLabel, lane) => (
          <button
            key={keyLabel}
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              handlePadTrigger(lane);
            }}
            className="min-h-[56px] flex flex-col items-center justify-center rounded-xl border border-white/[0.12] bg-[#131929] text-white active:scale-95 active:border-[var(--accent-primary)] active:bg-[var(--accent-soft)] transition-transform"
          >
            <span className="font-display text-base font-bold leading-none">
              {keyLabel}
            </span>
            <span className="mt-1 text-[10px] font-medium text-[#8B95A5]">
              Tecla {LANE_KEYS_ALT[lane]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
