import { useEffect, useState, type MouseEvent } from 'react';
import { BarChart3, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  castPollVote,
  fetchPollForPost,
  formatPollTimeRemaining,
  type PostPollData,
} from '../lib/phase3';

interface PollCardProps {
  poll: PostPollData;
  onOpenAuth: () => void;
  onPollUpdated?: (updated: PostPollData) => void;
}

function applyOptimisticVote(
  poll: PostPollData,
  nextIndex: number
): PostPollData {
  const prevIndex = poll.userVoteIndex;
  const counts = poll.optionStats.map((o) => o.votes);

  if (prevIndex !== null && prevIndex >= 0 && prevIndex < counts.length) {
    counts[prevIndex] = Math.max(0, counts[prevIndex] - 1);
  }
  if (nextIndex >= 0 && nextIndex < counts.length) {
    counts[nextIndex] += 1;
  }

  const totalVotes = counts.reduce((sum, c) => sum + c, 0);
  return {
    ...poll,
    userVoteIndex: nextIndex,
    totalVotes,
    optionStats: poll.optionStats.map((opt, idx) => ({
      ...opt,
      votes: counts[idx],
      percentage:
        totalVotes > 0 ? Math.round((counts[idx] / totalVotes) * 100) : 0,
    })),
  };
}

export function PollCard({
  poll: initialPoll,
  onOpenAuth,
  onPollUpdated,
}: PollCardProps) {
  const { user, isAuthenticated } = useAuth();
  const [poll, setPoll] = useState<PostPollData>(initialPoll);
  const [votingIndex, setVotingIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setPoll(initialPoll);
  }, [initialPoll]);

  const showResults =
    poll.userVoteIndex !== null || poll.isClosed || poll.totalVotes > 0;

  async function handleVote(
    event: MouseEvent<HTMLButtonElement>,
    optionIndex: number
  ) {
    event.stopPropagation();

    if (poll.isClosed) return;
    if (!isAuthenticated || !user) {
      onOpenAuth();
      return;
    }
    if (votingIndex !== null || poll.userVoteIndex === optionIndex) return;

    const previous = poll;
    const optimistic = applyOptimisticVote(poll, optionIndex);

    setErrorMsg(null);
    setVotingIndex(optionIndex);
    setPoll(optimistic);
    onPollUpdated?.(optimistic);

    try {
      await castPollVote({
        pollId: poll.id,
        userId: user.id,
        optionIndex,
      });
      const fresh = await fetchPollForPost(poll.post_id, user.id);
      if (fresh) {
        setPoll(fresh);
        onPollUpdated?.(fresh);
      }
    } catch (err) {
      setPoll(previous);
      onPollUpdated?.(previous);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo registrar tu voto en este momento.'
      );
    } finally {
      setVotingIndex(null);
    }
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3.5 sm:p-4 transition-colors duration-300"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <BarChart3
            size={16}
            className="mt-0.5 shrink-0 text-[var(--accent-primary)]"
            aria-hidden="true"
          />
          <p className="font-display text-sm font-bold leading-snug text-[var(--text-main)]">
            {poll.question}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2" role="group" aria-label={poll.question}>
        {poll.optionStats.map((opt) => {
          const isSelected = poll.userVoteIndex === opt.index;
          const isVotingThis = votingIndex === opt.index;
          const fillScale = showResults ? opt.percentage / 100 : 0;

          return (
            <button
              key={opt.index}
              type="button"
              disabled={poll.isClosed || votingIndex !== null}
              onClick={(e) => void handleVote(e, opt.index)}
              aria-pressed={isSelected}
              className={`group relative flex min-h-[42px] w-full items-center justify-between gap-3 overflow-hidden rounded-xl border px-3.5 py-2 text-left text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                isSelected
                  ? 'border-[var(--accent-primary)] bg-[var(--bg-card)] text-[var(--text-main)]'
                  : poll.isClosed
                    ? 'border-[var(--border-subtle)] bg-[var(--bg-card)]/70 text-[var(--text-secondary)] cursor-default'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-main)] hover:border-[var(--accent-border)]'
              }`}
            >
              {/* Barra de progreso animada usando el color de acento activo */}
              <span
                aria-hidden="true"
                style={{
                  transform: `scaleX(${fillScale})`,
                  transformOrigin: 'left center',
                }}
                className={`pointer-events-none absolute inset-0 transition-transform duration-500 ease-out ${
                  isSelected
                    ? 'bg-[var(--accent-primary)]/20'
                    : 'bg-[var(--accent-primary)]/10'
                }`}
              />

              <span className="relative z-10 flex items-center gap-2 min-w-0 font-medium">
                {isVotingThis ? (
                  <Loader2
                    size={15}
                    className="shrink-0 animate-spin text-[var(--accent-primary)]"
                    aria-hidden="true"
                  />
                ) : isSelected ? (
                  <CheckCircle2
                    size={15}
                    className="shrink-0 text-[var(--accent-primary)]"
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--border-subtle)] group-hover:border-[var(--accent-primary)] transition-colors"
                  />
                )}
                <span className="break-words">{opt.label}</span>
              </span>

              {showResults && (
                <span
                  className={`relative z-10 shrink-0 text-xs tabular-nums ${
                    isSelected
                      ? 'font-bold text-[var(--accent-primary)]'
                      : 'font-semibold text-[var(--text-secondary)]'
                  }`}
                >
                  {opt.percentage}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <p role="alert" className="mt-2 text-xs text-red-500 dark:text-red-300">
          {errorMsg}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
        <span className="tabular-nums font-medium">
          {poll.totalVotes}{' '}
          {poll.totalVotes === 1 ? 'participante' : 'participantes'}
          {poll.userVoteIndex !== null && !poll.isClosed
            ? ' · Toca otra opción para cambiar tu voto'
            : ''}
        </span>

        <span className="inline-flex items-center gap-1 tabular-nums">
          <Clock size={11} aria-hidden="true" />
          <span>{formatPollTimeRemaining(poll.ends_at)}</span>
        </span>
      </div>
    </div>
  );
}
