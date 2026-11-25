import { useCallback, useEffect, useRef, useState } from 'react';
import { Zap } from 'lucide-react';
import type { MiniGameEngineProps } from './types';

type PlatformKind = 'normal' | 'moving' | 'fragile' | 'boost';

interface Platform {
  id: number;
  x: number; // left
  y: number; // world Y (up is negative)
  w: number;
  h: number;
  kind: PlatformKind;
  vx: number;
  broken: boolean;
}

interface CorruptZone {
  id: number;
  x: number;
  y: number;
  radius: number;
  vx: number;
  phase: number;
}

interface EtherShard {
  id: number;
  x: number;
  y: number;
  collected: boolean;
  pulse: number;
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

export function SaltoVacioGame({
  difficulty,
  paused,
  runKey,
  accentHex,
  synth,
  onHudUpdate,
  onGameOver,
}: MiniGameEngineProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const pausedRef = useRef(paused);
  const accentRef = useRef(accentHex);
  const onHudRef = useRef(onHudUpdate);
  const onGameOverRef = useRef(onGameOver);

  const keysRef = useRef({ left: false, right: false });
  const pointerRef = useRef<{
    activeId: number | null;
    lastX: number;
    pendingDx: number;
  }>({ activeId: null, lastX: 0, pendingDx: 0 });
  const airBoostQueuedRef = useRef(false);
  const [airBoostCharge, setAirBoostCharge] = useState(100);

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

  const queueAirBoost = useCallback(() => {
    if (!pausedRef.current) {
      airBoostQueuedRef.current = true;
    }
  }, []);

  // Teclado PC: A/D, ←/→ y Espacio (impulso aéreo)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (pausedRef.current) return;
      const k = event.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        event.preventDefault();
        keysRef.current.left = true;
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        event.preventDefault();
        keysRef.current.right = true;
      } else if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') {
        event.preventDefault();
        airBoostQueuedRef.current = true;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const k = event.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        keysRef.current.left = false;
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        keysRef.current.right = false;
      }
    };

    const onBlur = () => {
      keysRef.current = { left: false, right: false };
      pointerRef.current.activeId = null;
      pointerRef.current.pendingDx = 0;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      keysRef.current = { left: false, right: false };
    };
  }, []);

  useEffect(() => {
    if (runKey === 0) return;
    const canvas = canvasRef.current;
    const container = stageRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = Math.max(300, container.clientWidth);
    let height = Math.max(420, container.clientHeight);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(300, Math.floor(rect.width));
      height = Math.max(420, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    // Parámetros calibrados por dificultad
    const gravity =
      difficulty.id === 'facil'
        ? 1120
        : difficulty.id === 'normal'
          ? 1350
          : difficulty.id === 'dificil'
            ? 1560
            : 1750;
    const jumpVelocity =
      difficulty.id === 'facil'
        ? -670
        : difficulty.id === 'normal'
          ? -730
          : difficulty.id === 'dificil'
            ? -785
            : -830;
    const cameraAutoClimb =
      difficulty.id === 'facil'
        ? 24
        : difficulty.id === 'normal'
          ? 42
          : difficulty.id === 'dificil'
            ? 66
            : 92;
    const fragileChance =
      difficulty.id === 'facil'
        ? 0.1
        : difficulty.id === 'normal'
          ? 0.22
          : difficulty.id === 'dificil'
            ? 0.34
            : 0.46;
    const movingChance =
      difficulty.id === 'facil'
        ? 0.12
        : difficulty.id === 'normal'
          ? 0.24
          : difficulty.id === 'dificil'
            ? 0.34
            : 0.4;
    const corruptChance =
      difficulty.id === 'facil'
        ? 0.08
        : difficulty.id === 'normal'
          ? 0.15
          : difficulty.id === 'dificil'
            ? 0.24
            : 0.32;

    const maxLives = difficulty.maxLives;
    let lives = maxLives;
    let bonusScore = 0;
    let maxAltitude = 0;
    let combo = 0;
    let airCharge = 100;
    let invulnTimer = 0;
    let elapsed = 0;
    let finished = false;
    let nextId = 1;

    // Coordenadas de mundo: Y crece hacia abajo, escalar = Y más negativo
    const startY = 0;
    let playerX = width / 2;
    let playerY = startY - 26;
    let playerVx = 0;
    let playerVy = jumpVelocity * 0.85;
    const playerRadius = 15;
    let cameraY = startY - height * 0.72;

    const platforms: Platform[] = [];
    const corrupts: CorruptZone[] = [];
    const shards: EtherShard[] = [];
    const particles: Particle[] = [];

    // Plataforma inicial amplia y segura
    platforms.push({
      id: nextId++,
      x: width / 2 - 75,
      y: startY,
      w: 150,
      h: 14,
      kind: 'normal',
      vx: 0,
      broken: false,
    });

    let highestPlatformY = startY;

    const spawnBurst = (x: number, y: number, color: string, count: number) => {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const mag = 70 + Math.random() * 140;
        particles.push({
          x,
          y,
          vx: Math.cos(ang) * mag,
          vy: Math.sin(ang) * mag,
          size: 2.5 + Math.random() * 3,
          color,
          life: 0.3 + Math.random() * 0.28,
          maxLife: 0.58,
        });
      }
    };

    const generateUpTo = (targetY: number) => {
      const gapMin = difficulty.id === 'facil' ? 62 : 70;
      const gapMax =
        difficulty.id === 'facil'
          ? 95
          : difficulty.id === 'normal'
            ? 112
            : difficulty.id === 'dificil'
              ? 124
              : 132;
      const platBaseW =
        difficulty.id === 'facil'
          ? 94
          : difficulty.id === 'normal'
            ? 82
            : difficulty.id === 'dificil'
              ? 74
              : 66;

      while (highestPlatformY > targetY) {
        const gap = gapMin + Math.random() * (gapMax - gapMin);
        const y = highestPlatformY - gap;
        const altFactor = Math.min(1, Math.abs(y) / 6000);
        const w = Math.max(52, platBaseW - altFactor * 14);
        const x = 14 + Math.random() * Math.max(20, width - w - 28);

        const roll = Math.random();
        let kind: PlatformKind = 'normal';
        let vx = 0;

        if (roll < 0.08) {
          kind = 'boost';
        } else if (roll < 0.08 + fragileChance + altFactor * 0.1) {
          kind = 'fragile';
        } else if (
          roll <
          0.08 + fragileChance + movingChance + altFactor * 0.12
        ) {
          kind = 'moving';
          const dir = Math.random() < 0.5 ? -1 : 1;
          vx = dir * (58 + Math.random() * 55) * difficulty.speedScale;
        }

        platforms.push({
          id: nextId++,
          x,
          y,
          w,
          h: 13,
          kind,
          vx,
          broken: false,
        });

        // Fragmento de éter coleccionable ocasional
        if (Math.random() < 0.28) {
          shards.push({
            id: nextId++,
            x: x + w / 2,
            y: y - 24,
            collected: false,
            pulse: Math.random() * Math.PI * 2,
          });
        }

        // Zona corrupta flotante a partir de cierta altura
        if (Math.abs(y) > 420 && Math.random() < corruptChance) {
          const cx = 28 + Math.random() * Math.max(30, width - 56);
          const dir = Math.random() < 0.5 ? -1 : 1;
          corrupts.push({
            id: nextId++,
            x: cx,
            y: y - gap * 0.45,
            radius: 14,
            vx: dir * (40 + Math.random() * 48) * difficulty.speedScale,
            phase: Math.random() * Math.PI * 2,
          });
        }

        highestPlatformY = y;
      }
    };

    generateUpTo(cameraY - height);

    let lastHudSig = '';
    const emitHud = (statusLabel?: string | null) => {
      const altMeters = Math.floor(maxAltitude / 12);
      const totalScore = Math.floor(maxAltitude * 0.45 + bonusScore);
      const roundedCharge = Math.floor(airCharge);
      const sig = `${totalScore}|${lives}|${altMeters}|${combo}|${roundedCharge}|${statusLabel ?? ''}`;
      if (sig === lastHudSig) return;
      lastHudSig = sig;
      setAirBoostCharge(roundedCharge);
      onHudRef.current({
        score: totalScore,
        lives,
        maxLives,
        stageLabel: `${altMeters} m`,
        combo,
        statusLabel: statusLabel ?? null,
      });
    };

    emitHud();

    const triggerDamage = (reason: string, rescueBounce = false) => {
      if (finished) return;
      lives = Math.max(0, lives - difficulty.damageScale);
      combo = 0;
      invulnTimer = 1.35;
      synth.damage();
      spawnBurst(playerX, playerY, '#F43F5E', 18);

      if (lives <= 0) {
        finished = true;
        const finalRawScore = Math.floor(maxAltitude * 0.45 + bonusScore);
        const meters = Math.floor(maxAltitude / 12);
        emitHud(reason);
        onGameOverRef.current(
          finalRawScore,
          `Altura alcanzada: ${meters.toLocaleString('es-ES')} m`
        );
        return;
      }

      if (rescueBounce) {
        playerY = cameraY + height - 56;
        playerVy = jumpVelocity * 1.35;
        synth.jump(true);
      } else {
        playerVy = Math.min(playerVy, jumpVelocity * 0.65);
      }
      emitHud(reason);
    };

    let animId = 0;
    let lastTs = performance.now();

    const frame = (now: number) => {
      animId = window.requestAnimationFrame(frame);
      const dt = Math.min(Math.max((now - lastTs) / 1000, 0.001), 0.05);
      lastTs = now;

      if (pausedRef.current || finished) return;

      elapsed += dt;
      invulnTimer = Math.max(0, invulnTimer - dt);
      airCharge = Math.min(100, airCharge + dt * 22);

      // Movimiento lateral por teclado o arrastre táctil
      const moveSpeed = 350;
      const axis =
        (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0);
      if (axis !== 0) {
        playerVx = axis * moveSpeed;
      } else {
        playerVx *= Math.pow(0.0015, dt);
      }
      playerX += playerVx * dt;

      if (pointerRef.current.pendingDx !== 0) {
        playerX += pointerRef.current.pendingDx * 1.15;
        pointerRef.current.pendingDx = 0;
      }

      // Envoltura horizontal suave (wrap-around clásico de escalada)
      if (playerX < -playerRadius) playerX = width + playerRadius;
      if (playerX > width + playerRadius) playerX = -playerRadius;

      // Impulso aéreo (Espacio o botón táctil)
      if (airBoostQueuedRef.current) {
        airBoostQueuedRef.current = false;
        if (airCharge >= 100) {
          airCharge = 0;
          playerVy = jumpVelocity * 1.25;
          synth.jump(true);
          spawnBurst(playerX, playerY + playerRadius, accentRef.current || '#3B82F6', 14);
          emitHud('Impulso aéreo');
        }
      }

      const prevBottom = playerY + playerRadius;
      playerVy += gravity * dt;
      playerY += playerVy * dt;
      const nextBottom = playerY + playerRadius;

      // Actualizar plataformas móviles y comprobar aterrizaje (solo al caer)
      for (const p of platforms) {
        if (p.broken) continue;
        if (p.kind === 'moving') {
          p.x += p.vx * dt;
          if (p.x < 10) {
            p.x = 10;
            p.vx = Math.abs(p.vx);
          } else if (p.x + p.w > width - 10) {
            p.x = width - 10 - p.w;
            p.vx = -Math.abs(p.vx);
          }
        }

        if (
          playerVy > 0 &&
          prevBottom <= p.y + 8 &&
          nextBottom >= p.y &&
          playerX + playerRadius * 0.72 >= p.x &&
          playerX - playerRadius * 0.72 <= p.x + p.w
        ) {
          playerY = p.y - playerRadius;
          if (p.kind === 'boost') {
            playerVy = jumpVelocity * 1.55;
            bonusScore += 65;
            combo += 1;
            synth.jump(true);
            spawnBurst(playerX, p.y, '#10B981', 16);
          } else if (p.kind === 'fragile') {
            playerVy = jumpVelocity * 1.02;
            p.broken = true;
            synth.jump(false);
            spawnBurst(p.x + p.w / 2, p.y, '#F59E0B', 12);
          } else {
            playerVy = jumpVelocity;
            synth.jump(false);
            spawnBurst(playerX, p.y, accentRef.current || '#3B82F6', 6);
          }
        }
      }

      // Fragmentos de éter
      for (const s of shards) {
        if (s.collected) continue;
        s.pulse += dt * 4.5;
        const dist = Math.hypot(playerX - s.x, playerY - s.y);
        if (dist <= playerRadius + 13) {
          s.collected = true;
          combo += 1;
          bonusScore += 45 + Math.min(combo, 12) * 8;
          airCharge = Math.min(100, airCharge + 25);
          synth.pickup(combo);
          spawnBurst(s.x, s.y, '#FBBF24', 10);
        }
      }

      // Zonas corruptas
      for (const c of corrupts) {
        c.phase += dt * 4;
        c.x += c.vx * dt;
        if (c.x < c.radius + 10) {
          c.x = c.radius + 10;
          c.vx = Math.abs(c.vx);
        } else if (c.x > width - c.radius - 10) {
          c.x = width - c.radius - 10;
          c.vx = -Math.abs(c.vx);
        }

        if (invulnTimer <= 0) {
          const dist = Math.hypot(playerX - c.x, playerY - c.y);
          if (dist < playerRadius + c.radius - 3) {
            triggerDamage('Zona corrupta', false);
            if (finished) return;
          }
        }
      }

      // Cámara ascendente (sigue altura máxima + empuje gradual del vacío)
      const altitudeNow = Math.max(0, startY - playerY);
      if (altitudeNow > maxAltitude) {
        maxAltitude = altitudeNow;
      }

      const targetCamY = playerY - height * 0.44;
      if (targetCamY < cameraY) {
        cameraY = targetCamY;
      }
      if (elapsed > 2.2) {
        const climbSpeed =
          cameraAutoClimb * (1 + Math.min(elapsed * 0.015, 0.85));
        cameraY -= climbSpeed * dt;
      }

      // Generar nuevas plataformas arriba y limpiar las de abajo
      generateUpTo(cameraY - height * 0.85);
      const cullY = cameraY + height + 80;
      for (let i = platforms.length - 1; i >= 0; i--) {
        if (platforms[i].y > cullY || platforms[i].broken) {
          platforms.splice(i, 1);
        }
      }
      for (let i = shards.length - 1; i >= 0; i--) {
        if (shards[i].y > cullY || shards[i].collected) {
          shards.splice(i, 1);
        }
      }
      for (let i = corrupts.length - 1; i >= 0; i--) {
        if (corrupts[i].y > cullY) corrupts.splice(i, 1);
      }

      // Caída al vacío inferior
      if (playerY - playerRadius > cameraY + height + 12) {
        triggerDamage('Caída al vacío', true);
        if (finished) return;
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
        if (pt.life <= 0) particles.splice(i, 1);
      }

      // ===================== RENDER =====================
      const accent = accentRef.current || '#3B82F6';
      ctx.fillStyle = '#080B13';
      ctx.fillRect(0, 0, width, height);

      // Cuadrícula paralaje vertical
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      const step = 48;
      const offsetY = ((-cameraY * 0.4) % step + step) % step;
      for (let y = offsetY; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Bruma peligrosa del vacío en el borde inferior
      const voidGrad = ctx.createLinearGradient(0, height - 48, 0, height);
      voidGrad.addColorStop(0, 'rgba(244,63,94,0)');
      voidGrad.addColorStop(1, 'rgba(244,63,94,0.34)');
      ctx.fillStyle = voidGrad;
      ctx.fillRect(0, height - 48, width, 48);

      // Plataformas
      for (const p of platforms) {
        const sy = p.y - cameraY;
        if (sy < -30 || sy > height + 30) continue;

        const topCol =
          p.kind === 'boost'
            ? '#10B981'
            : p.kind === 'fragile'
              ? '#F59E0B'
              : p.kind === 'moving'
                ? '#38BDF8'
                : accent;

        ctx.save();
        ctx.fillStyle = '#151B2B';
        ctx.strokeStyle = topCol;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(p.x, sy, p.w, p.h, 6);
        ctx.fill();
        ctx.stroke();

        // Línea superior luminosa
        ctx.fillStyle = topCol;
        ctx.fillRect(p.x + 4, sy + 1, p.w - 8, 3);

        if (p.kind === 'fragile') {
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x + p.w * 0.35, sy + 2);
          ctx.lineTo(p.x + p.w * 0.5, sy + p.h - 2);
          ctx.lineTo(p.x + p.w * 0.62, sy + 3);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Fragmentos de éter
      for (const s of shards) {
        const sy = s.y - cameraY;
        if (sy < -20 || sy > height + 20) continue;
        const r = 7 + Math.sin(s.pulse) * 1.4;
        ctx.save();
        ctx.translate(s.x, sy);
        ctx.fillStyle = '#FBBF24';
        ctx.shadowColor = '#FBBF24';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.85, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r * 0.85, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Zonas corruptas
      for (const c of corrupts) {
        const sy = c.y - cameraY;
        if (sy < -30 || sy > height + 30) continue;
        ctx.save();
        ctx.translate(c.x, sy);
        ctx.rotate(c.phase * 0.7);
        ctx.fillStyle = '#2B101C';
        ctx.strokeStyle = '#F43F5E';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const ang = (Math.PI * 2 * i) / 8;
          const rad = i % 2 === 0 ? c.radius : c.radius * 0.56;
          const px = Math.cos(ang) * rad;
          const py = Math.sin(ang) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Jugador
      const playerSy = playerY - cameraY;
      const blinkSkip =
        invulnTimer > 0 && Math.floor(invulnTimer * 16) % 2 === 0;
      if (!blinkSkip) {
        ctx.save();
        ctx.translate(playerX, playerSy);
        const tilt = Math.max(-0.35, Math.min(0.35, playerVx / 700));
        ctx.rotate(tilt);
        ctx.fillStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, playerRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-4.5, -3, 3, 0, Math.PI * 2);
        ctx.arc(4.5, -3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Partículas
      for (const pt of particles) {
        const sy = pt.y - cameraY;
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillRect(pt.x - pt.size / 2, sy - pt.size / 2, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;

      emitHud();
    };

    animId = window.requestAnimationFrame(frame);
    return () => {
      window.cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [difficulty, runKey, synth]);

  const boostReady = airBoostCharge >= 100;

  return (
    <div
      ref={stageRef}
      className="relative h-full w-full overflow-hidden bg-[#080B13] touch-none select-none"
    >
      <canvas
        ref={canvasRef}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pointerRef.current.activeId = event.pointerId;
          pointerRef.current.lastX = event.clientX;
        }}
        onPointerMove={(event) => {
          const p = pointerRef.current;
          if (p.activeId !== event.pointerId) return;
          p.pendingDx += event.clientX - p.lastX;
          p.lastX = event.clientX;
        }}
        onPointerUp={(event) => {
          if (pointerRef.current.activeId === event.pointerId) {
            pointerRef.current.activeId = null;
          }
        }}
        onPointerCancel={(event) => {
          if (pointerRef.current.activeId === event.pointerId) {
            pointerRef.current.activeId = null;
          }
        }}
        className="block h-full w-full"
      />

      {/* Botón táctil de Impulso Aéreo (Salto del Vacío) */}
      <button
        type="button"
        onPointerDown={(event) => {
          event.stopPropagation();
          queueAirBoost();
        }}
        disabled={!boostReady}
        className={`absolute bottom-5 right-4 z-10 min-h-[50px] inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-bold tracking-wide transition-all active:scale-95 ${
          boostReady
            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-fg)] shadow-lg'
            : 'border-white/[0.12] bg-[#11151E]/90 text-[#8F99AB]'
        }`}
      >
        <Zap size={15} aria-hidden="true" />
        <span className="tabular-nums">Impulso {airBoostCharge}%</span>
      </button>
    </div>
  );
}
