import type { MouseEvent } from 'react';
import { Loader2, UserCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocial } from '../context/SocialContext';

interface FollowButtonProps {
  targetUserId: string | null | undefined;
  onOpenAuth: () => void;
  size?: 'xs' | 'sm' | 'md';
  onChanged?: (nowFollowing: boolean) => void;
  className?: string;
}

export function FollowButton({
  targetUserId,
  onOpenAuth,
  size = 'sm',
  onChanged,
  className = '',
}: FollowButtonProps) {
  const { user, isAuthenticated } = useAuth();
  const { isFollowing, busyFollowIds, toggleFollow } = useSocial();

  // Oculto si no hay autor o si es la propia cuenta del usuario conectado
  if (!targetUserId || (user && user.id === targetUserId)) {
    return null;
  }

  const following = isFollowing(targetUserId);
  const isBusy = Boolean(busyFollowIds[targetUserId]);

  const sizeClasses =
    size === 'xs'
      ? 'h-7 px-2.5 text-[11px] gap-1 rounded-lg'
      : size === 'md'
        ? 'min-h-[42px] px-4 text-sm gap-2 rounded-xl'
        : 'h-8 px-3 text-xs gap-1.5 rounded-lg';

  const iconSize = size === 'xs' ? 12 : size === 'md' ? 16 : 13;

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }
    if (!targetUserId || isBusy) return;
    const nextState = await toggleFollow(targetUserId);
    onChanged?.(nextState);
  }

  return (
    <button
      type="button"
      onClick={(e) => void handleClick(e)}
      disabled={isBusy}
      aria-pressed={following}
      aria-label={following ? 'Dejar de seguir autor' : 'Seguir autor'}
      className={`inline-flex shrink-0 items-center justify-center font-semibold transition-colors duration-300 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${sizeClasses} ${
        following
          ? 'border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:border-red-500/35 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300'
          : 'border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-fg)]'
      } ${className}`}
    >
      {isBusy ? (
        <Loader2 size={iconSize} className="animate-spin" aria-hidden="true" />
      ) : following ? (
        <UserCheck size={iconSize} aria-hidden="true" />
      ) : (
        <UserPlus size={iconSize} aria-hidden="true" />
      )}
      <span>{following ? 'Siguiendo' : 'Seguir'}</span>
    </button>
  );
}
