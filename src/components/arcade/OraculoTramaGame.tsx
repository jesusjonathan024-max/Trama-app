import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Flame, Timer, XCircle } from 'lucide-react';
import {
  shuffleTriviaQuestions,
  type TriviaQuestion,
} from '../../lib/triviaQuestions';
import type { MiniGameEngineProps } from './types';

const MAX_QUESTIONS_PER_RUN = 20;
const OPTION_KEYS = ['1', '2', '3', '4'] as const;

export function OraculoTramaGame({
  difficulty,
  paused,
  runKey,
  synth,
  onHudUpdate,
  onGameOver,
}: MiniGameEngineProps) {
  const secondsPerQuestion = difficulty.triviaSeconds; // 15s / 10s / 7s / 5s
  const wrongPenalty = difficulty.triviaWrongPenalty; // 0 / 0 / 50 / 100

  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(secondsPerQuestion);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [streak, setStreak] = useState(0);
  const [feedbackNote, setFeedbackNote] = useState<string | null>(null);

  const pausedRef = useRef(paused);
  const finishedRef = useRef(false);
  const lockedRef = useRef(false);
  const scoreRef = useRef(0);
  const livesRef = useRef(difficulty.maxLives);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const correctCountRef = useRef(0);
  const questionIndexRef = useRef(0);
  const timeLeftRef = useRef(secondsPerQuestion);
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
    (qIdx: number, statusLabel?: string | null) => {
      onHudRef.current({
        score: Math.floor(scoreRef.current),
        lives: livesRef.current,
        maxLives: difficulty.maxLives,
        stageLabel: `${Math.min(qIdx + 1, MAX_QUESTIONS_PER_RUN)}/${MAX_QUESTIONS_PER_RUN}`,
        combo: streakRef.current,
        statusLabel: statusLabel ?? null,
      });
    },
    [difficulty.maxLives]
  );

  // Inicializar mazo aleatorio al comenzar partida
  useEffect(() => {
    if (runKey === 0) return;
    const deck = shuffleTriviaQuestions().slice(0, MAX_QUESTIONS_PER_RUN);
    finishedRef.current = false;
    lockedRef.current = false;
    scoreRef.current = 0;
    livesRef.current = difficulty.maxLives;
    streakRef.current = 0;
    bestStreakRef.current = 0;
    correctCountRef.current = 0;
    questionIndexRef.current = 0;
    timeLeftRef.current = secondsPerQuestion;

    setQuestions(deck);
    setQuestionIndex(0);
    setTimeLeft(secondsPerQuestion);
    setSelectedIndex(null);
    setTimedOut(false);
    setStreak(0);
    setFeedbackNote(null);
    emitHud(0, null);
  }, [runKey, difficulty.maxLives, secondsPerQuestion, emitHud]);

  const currentQuestion = questions[questionIndex] ?? null;

  const advanceOrFinish = useCallback(
    (nextLives: number) => {
      if (finishedRef.current) return;
      const currentIdx = questionIndexRef.current;

      if (nextLives <= 0) {
        finishedRef.current = true;
        onGameOverRef.current(
          Math.floor(scoreRef.current),
          `${correctCountRef.current} aciertos · Mejor racha: ${bestStreakRef.current}x`
        );
        return;
      }

      if (currentIdx + 1 >= MAX_QUESTIONS_PER_RUN) {
        finishedRef.current = true;
        const clearBonus = 250;
        scoreRef.current += clearBonus;
        emitHud(currentIdx, `+${clearBonus} ¡Cuestionario completo!`);
        synth.successChime();
        onGameOverRef.current(
          Math.floor(scoreRef.current),
          `¡Completado! ${correctCountRef.current}/${MAX_QUESTIONS_PER_RUN} aciertos · Racha máx. ${bestStreakRef.current}x`
        );
        return;
      }

      const nextIdx = currentIdx + 1;
      questionIndexRef.current = nextIdx;
      timeLeftRef.current = secondsPerQuestion;
      lockedRef.current = false;
      setQuestionIndex(nextIdx);
      setSelectedIndex(null);
      setTimedOut(false);
      setFeedbackNote(null);
      setTimeLeft(secondsPerQuestion);
      emitHud(nextIdx, null);
    },
    [emitHud, secondsPerQuestion, synth]
  );

  const resolveAnswer = useCallback(
    (optionIndex: number | null) => {
      if (
        finishedRef.current ||
        lockedRef.current ||
        !currentQuestion ||
        pausedRef.current
      ) {
        return;
      }

      lockedRef.current = true;
      setSelectedIndex(optionIndex);
      setTimedOut(optionIndex === null);

      const isCorrect =
        optionIndex !== null && optionIndex === currentQuestion.correctIndex;

      if (isCorrect) {
        const nextStreak = streakRef.current + 1;
        streakRef.current = nextStreak;
        if (nextStreak > bestStreakRef.current) {
          bestStreakRef.current = nextStreak;
        }
        correctCountRef.current += 1;
        setStreak(nextStreak);

        const streakMult = Math.min(3, 1 + (nextStreak - 1) * 0.25);
        const speedBonus = Math.round(
          (timeLeftRef.current / Math.max(1, secondsPerQuestion)) * 60
        );
        const gained = Math.round((100 + speedBonus) * streakMult);
        scoreRef.current += gained;
        setFeedbackNote(`¡Correcto! +${gained} pts (racha ×${streakMult.toFixed(2)})`);
        synth.successChime();
        emitHud(questionIndexRef.current, `+${gained} pts`);
      } else {
        streakRef.current = 0;
        setStreak(0);
        livesRef.current = Math.max(0, livesRef.current - difficulty.damageScale);
        if (wrongPenalty > 0) {
          scoreRef.current = Math.max(0, scoreRef.current - wrongPenalty);
        }
        const reason = optionIndex === null ? 'Tiempo agotado' : 'Respuesta incorrecta';
        setFeedbackNote(
          wrongPenalty > 0
            ? `${reason} · -${wrongPenalty} pts`
            : reason
        );
        synth.damage();
        emitHud(questionIndexRef.current, reason);
      }

      const snapshotLives = livesRef.current;
      window.setTimeout(() => {
        advanceOrFinish(snapshotLives);
      }, 900);
    },
    [
      currentQuestion,
      difficulty.damageScale,
      wrongPenalty,
      secondsPerQuestion,
      synth,
      emitHud,
      advanceOrFinish,
    ]
  );

  // Reloj regresivo por pregunta
  useEffect(() => {
    if (!currentQuestion || finishedRef.current) return;
    let lastTs = performance.now();

    const interval = window.setInterval(() => {
      if (pausedRef.current || lockedRef.current || finishedRef.current) {
        lastTs = performance.now();
        return;
      }
      const now = performance.now();
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      const next = Math.max(0, timeLeftRef.current - dt);
      timeLeftRef.current = next;
      setTimeLeft(next);
      if (next <= 0) {
        window.clearInterval(interval);
        resolveAnswer(null);
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [currentQuestion, resolveAnswer]);

  // Atajos de teclado 1, 2, 3, 4
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (pausedRef.current || lockedRef.current || finishedRef.current) return;
      const idx = OPTION_KEYS.indexOf(event.key as (typeof OPTION_KEYS)[number]);
      if (idx !== -1) {
        event.preventDefault();
        resolveAnswer(idx);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resolveAnswer]);

  if (!currentQuestion) return null;

  const timePct = Math.max(
    0,
    Math.min(100, (timeLeft / Math.max(1, secondsPerQuestion)) * 100)
  );
  const streakMult = Math.min(3, 1 + Math.max(0, streak) * 0.25);
  const isRevealed = selectedIndex !== null || timedOut;

  return (
    <div className="flex h-full w-full flex-col justify-between overflow-y-auto bg-[var(--bg-base)] px-4 py-4 sm:px-6 transition-colors duration-300">
      <div className="mx-auto w-full max-w-[460px]">
        {/* Cabecera de pregunta: categoría, racha y reloj */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <span className="font-bold text-[var(--accent-primary)]">
              {currentQuestion.category}
            </span>
            <span aria-hidden="true" className="text-[var(--text-muted)]">
              ·
            </span>
            <span className="tabular-nums">
              Pregunta {questionIndex + 1} de {MAX_QUESTIONS_PER_RUN}
            </span>
          </div>

          <div className="flex items-center gap-2.5 tabular-nums">
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-300">
                <Flame size={13} aria-hidden="true" />
                <span>
                  {streak} (×{streakMult.toFixed(2)})
                </span>
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 font-mono font-bold ${
                timePct <= 28
                  ? 'text-rose-500'
                  : 'text-[var(--text-main)]'
              }`}
            >
              <Timer size={13} aria-hidden="true" />
              <span>{timeLeft.toFixed(1)}s</span>
            </span>
          </div>
        </div>

        {/* Barra de tiempo regresivo */}
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
          <div
            style={{
              transform: `scaleX(${timePct / 100})`,
              transformOrigin: 'left center',
            }}
            className={`h-full w-full rounded-full transition-transform duration-75 ${
              timePct <= 28
                ? 'bg-rose-500'
                : timePct <= 55
                  ? 'bg-amber-500'
                  : 'bg-[var(--accent-primary)]'
            }`}
          />
        </div>

        {/* Tarjeta de pregunta */}
        <div className="mt-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-sm transition-colors duration-300">
          <h3 className="text-balance font-display text-lg font-bold leading-snug text-[var(--text-main)] sm:text-xl">
            {currentQuestion.question}
          </h3>
          {wrongPenalty > 0 && (
            <p className="mt-2 text-[11px] font-medium text-rose-500 dark:text-rose-300">
              Penalización por fallo en {difficulty.label}: -{wrongPenalty} pts
              {difficulty.damageScale > 1 ? ' · Daño doble' : ''}
            </p>
          )}
        </div>

        {/* 4 Opciones de respuesta */}
        <div className="mt-4 space-y-2.5">
          {currentQuestion.options.map((optionText, idx) => {
            const isCorrectOpt = idx === currentQuestion.correctIndex;
            const isChosenOpt = selectedIndex === idx;

            let styleClass =
              'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-main)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-elevated)]';

            if (isRevealed) {
              if (isCorrectOpt) {
                styleClass =
                  'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200';
              } else if (isChosenOpt && !isCorrectOpt) {
                styleClass =
                  'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-200';
              } else {
                styleClass =
                  'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-muted)] opacity-60';
              }
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={isRevealed}
                onClick={() => resolveAnswer(idx)}
                className={`min-h-[52px] w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${styleClass}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-current/20 text-xs font-mono font-bold opacity-80">
                    {OPTION_KEYS[idx]}
                  </span>
                  <span className="break-words">{optionText}</span>
                </div>

                {isRevealed && isCorrectOpt && (
                  <CheckCircle2
                    size={17}
                    className="shrink-0 text-emerald-500"
                    aria-hidden="true"
                  />
                )}
                {isRevealed && isChosenOpt && !isCorrectOpt && (
                  <XCircle
                    size={17}
                    className="shrink-0 text-rose-500"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Retroalimentación inmediata */}
        <div className="mt-4 min-h-[28px] text-center text-xs font-semibold">
          {feedbackNote && (
            <span
              className={
                selectedIndex === currentQuestion.correctIndex
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-rose-600 dark:text-rose-300'
              }
            >
              {feedbackNote}
            </span>
          )}
        </div>
      </div>

      {/* Pie discreto */}
      <div className="mx-auto mt-2 flex w-full max-w-[460px] items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span>Atajos: teclas 1–4</span>
        <span>Tiempo base: {secondsPerQuestion}s</span>
      </div>
    </div>
  );
}
