import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Eye, Timer, XCircle } from 'lucide-react';
import type { MiniGameEngineProps } from './types';

const RUNE_GLYPHS = [
  '◈',
  '✦',
  '⬡',
  '△',
  '◎',
  '✧',
  '❖',
  '◇',
  '✴',
  '⬟',
  '⬢',
  '✪',
] as const;

type RoundPhase = 'SHOWING' | 'INPUT' | 'SUCCESS' | 'ERROR';

function buildConnectedRunePath(gridSize: number, targetLength: number): number[] {
  const total = gridSize * gridSize;
  const maxLen = Math.min(targetLength, Math.max(3, total - 1));

  for (let attempt = 0; attempt < 25; attempt++) {
    const start = Math.floor(Math.random() * total);
    const path = [start];
    const visited = new Set<number>([start]);

    while (path.length < maxLen) {
      const current = path[path.length - 1];
      const r = Math.floor(current / gridSize);
      const c = current % gridSize;
      const neighbors: number[] = [];

      if (r > 0) neighbors.push((r - 1) * gridSize + c);
      if (r < gridSize - 1) neighbors.push((r + 1) * gridSize + c);
      if (c > 0) neighbors.push(r * gridSize + (c - 1));
      if (c < gridSize - 1) neighbors.push(r * gridSize + (c + 1));

      const available = neighbors.filter((idx) => !visited.has(idx));
      if (available.length === 0) break;

      const pick = available[Math.floor(Math.random() * available.length)];
      path.push(pick);
      visited.add(pick);
    }

    if (path.length >= maxLen) {
      return path;
    }
  }

  // Fallback determinista si un paseo aleatorio se encierra
  const fallback: number[] = [];
  for (let i = 0; i < maxLen; i++) {
    fallback.push(i);
  }
  return fallback;
}

export function CodiceRunicoGame({
  difficulty,
  paused,
  runKey,
  synth,
  onHudUpdate,
  onGameOver,
}: MiniGameEngineProps) {
  const gridSize = difficulty.codiceGridSize; // 4x4 Fácil, 5x5 Normal/Difícil, 6x6 Pesadilla
  const totalCells = gridSize * gridSize;

  const cellGlyphs = useMemo(
    () =>
      Array.from(
        { length: totalCells },
        (_, idx) => RUNE_GLYPHS[(idx * 5 + runKey) % RUNE_GLYPHS.length]
      ),
    [totalCells, runKey]
  );

  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<RoundPhase>('SHOWING');
  const [pattern, setPattern] = useState<number[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [activeLitIndex, setActiveLitIndex] = useState<number | null>(null);
  const [enteredPath, setEnteredPath] = useState<number[]>([]);
  const [wrongCell, setWrongCell] = useState<number | null>(null);
  const [lives, setLives] = useState(difficulty.maxLives);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [maxTime, setMaxTime] = useState(15);

  const pausedRef = useRef(paused);
  const finishedRef = useRef(false);
  const scoreRef = useRef(0);
  const livesRef = useRef(difficulty.maxLives);
  const roundRef = useRef(1);
  const comboRef = useRef(0);
  const onHudRef = useRef(onHudUpdate);
  const onGameOverRef = useRef(onGameOver);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    onHudRef.current = onHudUpdate;
    onGameOverRef.current = onGameOver;
  }, [onHudUpdate, onGameOver]);

  const emitHud = useCallback(
    (
      nextScore: number,
      nextLives: number,
      nextRound: number,
      nextCombo: number,
      statusLabel?: string | null
    ) => {
      onHudRef.current({
        score: Math.floor(nextScore),
        lives: nextLives,
        maxLives: difficulty.maxLives,
        stageLabel: `Ronda ${nextRound}`,
        combo: nextCombo,
        statusLabel: statusLabel ?? null,
      });
    },
    [difficulty.maxLives]
  );

  const startRound = useCallback(
    (nextRound: number) => {
      const baseLen =
        difficulty.id === 'facil'
          ? 3
          : difficulty.id === 'normal'
            ? 3
            : difficulty.id === 'dificil'
              ? 4
              : 4;
      const targetLen = Math.min(
        baseLen + Math.floor((nextRound - 1) * 0.75),
        gridSize === 4 ? 9 : gridSize === 5 ? 12 : 14
      );
      const nextPattern = buildConnectedRunePath(gridSize, targetLen);
      const turnSeconds =
        difficulty.id === 'facil'
          ? 18
          : difficulty.id === 'normal'
            ? 14
            : difficulty.id === 'dificil'
              ? 11
              : 9;

      roundRef.current = nextRound;
      setRound(nextRound);
      setPattern(nextPattern);
      setEnteredPath([]);
      setWrongCell(null);
      setRevealedCount(0);
      setActiveLitIndex(null);
      setMaxTime(turnSeconds);
      setTimeLeft(turnSeconds);
      setPhase('SHOWING');
    },
    [difficulty.id, gridSize]
  );

  // Reinicio al iniciar partida
  useEffect(() => {
    if (runKey === 0) return;
    finishedRef.current = false;
    scoreRef.current = 0;
    livesRef.current = difficulty.maxLives;
    roundRef.current = 1;
    comboRef.current = 0;
    setLives(difficulty.maxLives);
    setCombo(0);
    emitHud(0, difficulty.maxLives, 1, 0, 'Memoriza');
    startRound(1);
  }, [runKey, difficulty.maxLives, emitHud, startRound]);

  // Fase SHOWING: ilumina la secuencia paso a paso
  useEffect(() => {
    if (phase !== 'SHOWING' || pattern.length === 0 || finishedRef.current) return;

    const stepMs =
      difficulty.id === 'facil'
        ? 680
        : difficulty.id === 'normal'
          ? 520
          : difficulty.id === 'dificil'
            ? 390
            : 300;
    const holdEndMs =
      difficulty.id === 'facil'
        ? 950
        : difficulty.id === 'normal'
          ? 700
          : difficulty.id === 'dificil'
            ? 500
            : 380;

    let step = 0;
    let timerId = 0;

    const advance = () => {
      if (pausedRef.current) {
        timerId = window.setTimeout(advance, 150);
        return;
      }

      if (step < pattern.length) {
        const cellIdx = pattern[step];
        setActiveLitIndex(cellIdx);
        setRevealedCount(step + 1);
        synth.note(step % 4, true);
        step += 1;
        timerId = window.setTimeout(advance, stepMs);
      } else {
        timerId = window.setTimeout(() => {
          if (finishedRef.current) return;
          setActiveLitIndex(null);
          setPhase('INPUT');
          emitHud(
            scoreRef.current,
            livesRef.current,
            roundRef.current,
            comboRef.current,
            'Tu turno'
          );
        }, holdEndMs);
      }
    };

    timerId = window.setTimeout(advance, 420);
    return () => window.clearTimeout(timerId);
  }, [phase, pattern, difficulty.id, synth, emitHud]);

  const handleFailure = useCallback(
    (badCell: number | null) => {
      if (finishedRef.current) return;
      setWrongCell(badCell);
      setPhase('ERROR');
      comboRef.current = 0;
      setCombo(0);

      const nextLives = Math.max(0, livesRef.current - difficulty.damageScale);
      livesRef.current = nextLives;
      setLives(nextLives);
      synth.damage();
      emitHud(scoreRef.current, nextLives, roundRef.current, 0, 'Fallo');

      window.setTimeout(() => {
        if (finishedRef.current) return;
        if (nextLives <= 0) {
          finishedRef.current = true;
          onGameOverRef.current(
            Math.floor(scoreRef.current),
            `Tablero ${gridSize}×${gridSize} · Alcanzaste la Ronda ${roundRef.current}`
          );
        } else {
          // Vuelve a mostrar el mismo patrón para reintentar la ronda
          setEnteredPath([]);
          setWrongCell(null);
          setRevealedCount(0);
          setActiveLitIndex(null);
          setTimeLeft(maxTime);
          setPhase('SHOWING');
        }
      }, 780);
    },
    [difficulty.damageScale, emitHud, gridSize, maxTime, synth]
  );

  // Reloj regresivo durante la fase INPUT
  useEffect(() => {
    if (phase !== 'INPUT' || finishedRef.current) return;
    let lastTs = performance.now();
    const interval = window.setInterval(() => {
      if (pausedRef.current || finishedRef.current) {
        lastTs = performance.now();
        return;
      }
      const now = performance.now();
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      setTimeLeft((prev) => {
        const next = Math.max(0, prev - dt);
        if (next <= 0) {
          window.clearInterval(interval);
          handleFailure(null);
        }
        return next;
      });
    }, 60);

    return () => window.clearInterval(interval);
  }, [phase, handleFailure]);

  function handleCellClick(cellIdx: number) {
    if (pausedRef.current || phase !== 'INPUT' || finishedRef.current) return;

    const expectedIdx = pattern[enteredPath.length];
    if (cellIdx !== expectedIdx) {
      handleFailure(cellIdx);
      return;
    }

    const nextEntered = [...enteredPath, cellIdx];
    const nextCombo = comboRef.current + 1;
    comboRef.current = nextCombo;
    setCombo(nextCombo);
    setEnteredPath(nextEntered);

    const stepPoints = Math.round(45 * (1 + Math.min(nextCombo, 20) * 0.1));
    scoreRef.current += stepPoints;
    synth.note((nextEntered.length - 1) % 4, true);

    if (nextEntered.length >= pattern.length) {
      // ¡Ronda completada!
      const timeBonus = Math.round(timeLeft * 18);
      const roundBonus = 110 + roundRef.current * 25;
      scoreRef.current += roundBonus + timeBonus;
      setPhase('SUCCESS');
      synth.successChime();
      emitHud(
        scoreRef.current,
        livesRef.current,
        roundRef.current,
        nextCombo,
        `+${roundBonus + timeBonus} pts`
      );

      window.setTimeout(() => {
        if (finishedRef.current) return;
        startRound(roundRef.current + 1);
      }, 720);
    } else {
      emitHud(
        scoreRef.current,
        livesRef.current,
        roundRef.current,
        nextCombo,
        `${nextEntered.length}/${pattern.length}`
      );
    }
  }

  const timePct = Math.max(0, Math.min(100, (timeLeft / Math.max(1, maxTime)) * 100));

  return (
    <div className="flex h-full w-full flex-col justify-between overflow-y-auto bg-[var(--bg-base)] px-4 py-4 sm:px-6 transition-colors duration-300">
      {/* Cabecera de estado de ronda y barra de tiempo */}
      <div className="mx-auto w-full max-w-[440px]">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-main)]">
            {phase === 'SHOWING' ? (
              <>
                <Eye size={14} className="text-[var(--accent-primary)]" aria-hidden="true" />
                <span>Memoriza la ruta ({pattern.length} runas)</span>
              </>
            ) : phase === 'SUCCESS' ? (
              <>
                <CheckCircle2 size={14} className="text-emerald-500" aria-hidden="true" />
                <span className="text-emerald-600 dark:text-emerald-300">
                  ¡Secuencia completada!
                </span>
              </>
            ) : phase === 'ERROR' ? (
              <>
                <XCircle size={14} className="text-rose-500" aria-hidden="true" />
                <span className="text-rose-600 dark:text-rose-300">
                  {wrongCell === null ? 'Tiempo agotado' : 'Runa incorrecta'}
                </span>
              </>
            ) : (
              <>
                <Timer size={14} className="text-[var(--accent-primary)]" aria-hidden="true" />
                <span>
                  Reproduce en orden ({enteredPath.length}/{pattern.length})
                </span>
              </>
            )}
          </div>

          <span className="font-mono text-xs font-bold tabular-nums text-[var(--text-secondary)]">
            {gridSize}×{gridSize} · {Math.ceil(timeLeft)}s
          </span>
        </div>

        {/* Barra de tiempo regresivo */}
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
          <div
            style={{
              transform: `scaleX(${phase === 'SHOWING' ? 1 : timePct / 100})`,
              transformOrigin: 'left center',
            }}
            className={`h-full w-full rounded-full transition-transform duration-100 ${
              phase === 'SHOWING'
                ? 'bg-[var(--accent-primary)]/50'
                : timePct <= 25
                  ? 'bg-rose-500'
                  : 'bg-[var(--accent-primary)]'
            }`}
          />
        </div>
      </div>

      {/* Tablero táctico de runas */}
      <div className="my-auto flex items-center justify-center py-4">
        <div
          className="grid w-full max-w-[400px] gap-2 sm:gap-2.5"
          style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: totalCells }).map((_, idx) => {
            const patternPos = pattern.indexOf(idx);
            const isRevealedInShow =
              phase === 'SHOWING' &&
              patternPos !== -1 &&
              patternPos < revealedCount;
            const isCurrentPulse = phase === 'SHOWING' && activeLitIndex === idx;
            const enteredPos = enteredPath.indexOf(idx);
            const isEntered = enteredPos !== -1;
            const isWrong = phase === 'ERROR' && wrongCell === idx;
            const showMissedHint =
              phase === 'ERROR' && patternPos === enteredPath.length;

            const orderNumber =
              isRevealedInShow
                ? patternPos + 1
                : isEntered
                  ? enteredPos + 1
                  : null;

            return (
              <button
                key={idx}
                type="button"
                disabled={phase !== 'INPUT'}
                onClick={() => handleCellClick(idx)}
                aria-label={`Runa ${idx + 1}`}
                className={`relative aspect-square w-full flex flex-col items-center justify-center rounded-xl border transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  isWrong
                    ? 'scale-95 border-rose-500 bg-rose-500/25 text-rose-200'
                    : showMissedHint
                      ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                      : isCurrentPulse
                        ? 'scale-105 border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-fg)] shadow-lg'
                        : isRevealedInShow || isEntered
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:text-[var(--text-main)] active:scale-95'
                }`}
              >
                <span
                  className={`leading-none font-bold ${
                    gridSize === 6
                      ? 'text-lg sm:text-xl'
                      : gridSize === 5
                        ? 'text-xl sm:text-2xl'
                        : 'text-2xl sm:text-3xl'
                  }`}
                >
                  {cellGlyphs[idx]}
                </span>
                {orderNumber !== null && (
                  <span
                    className={`absolute right-1.5 top-1 text-[10px] font-bold tabular-nums ${
                      isCurrentPulse
                        ? 'text-[var(--accent-fg)]'
                        : 'text-[var(--accent-primary)]'
                    }`}
                  >
                    {orderNumber}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pie informativo */}
      <div className="mx-auto flex w-full max-w-[440px] items-center justify-between text-xs text-[var(--text-muted)] tabular-nums">
        <span>Ronda {round}</span>
        <span>Racha: {combo}x</span>
        <span>Escudos: {lives}/{difficulty.maxLives}</span>
      </div>
    </div>
  );
}
