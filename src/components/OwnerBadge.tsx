import { Award, BadgeCheck, Crown, ShieldCheck } from 'lucide-react';
import { isOwnerRole } from '../lib/supabase';

interface OwnerBadgeProps {
  role?: string | null;
  badge?: string | null;
  size?: 'xs' | 'sm' | 'md';
}

const SIZE_CLASSES: Record<NonNullable<OwnerBadgeProps['size']>, string> = {
  xs: 'gap-1 px-1.5 py-0.5 text-[10px]',
  sm: 'gap-1 px-2 py-0.5 text-[11px]',
  md: 'gap-1.5 px-2.5 py-1 text-xs',
};

const ICON_SIZES: Record<NonNullable<OwnerBadgeProps['size']>, number> = {
  xs: 10,
  sm: 11,
  md: 13,
};

function getMemberBadgeStyle(badge: string) {
  const normalized = badge.trim().toLowerCase();
  if (normalized === 'fundador') {
    return {
      Icon: Award,
      classes:
        'border-violet-500/35 bg-violet-500/12 text-violet-700 dark:border-violet-400/40 dark:bg-violet-500/15 dark:text-violet-200',
      iconClass: 'text-violet-600 dark:text-violet-300',
    };
  }
  if (normalized === 'autor verificado') {
    return {
      Icon: BadgeCheck,
      classes:
        'border-sky-500/35 bg-sky-500/12 text-sky-700 dark:border-sky-400/40 dark:bg-sky-500/15 dark:text-sky-200',
      iconClass: 'text-sky-600 dark:text-sky-300',
    };
  }
  if (normalized === 'moderador') {
    return {
      Icon: ShieldCheck,
      classes:
        'border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-200',
      iconClass: 'text-emerald-600 dark:text-emerald-300',
    };
  }
  return {
    Icon: Award,
    classes:
      'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-main)]',
    iconClass: 'text-[var(--accent-primary)]',
  };
}

export function OwnerBadge({ role, badge, size = 'sm' }: OwnerBadgeProps) {
  const showOwner = isOwnerRole(role);
  const cleanedBadge = (badge ?? '').trim();
  const showMemberBadge = cleanedBadge.length > 0;

  if (!showOwner && !showMemberBadge) return null;

  const badgeStyle = showMemberBadge ? getMemberBadgeStyle(cleanedBadge) : null;
  const BadgeIcon = badgeStyle?.Icon;

  return (
    <>
      {showOwner && (
        <span
          title="Dueño de Trama"
          className={`inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/15 font-semibold tracking-wide text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-300 whitespace-nowrap shrink-0 select-none transition-colors duration-300 ${SIZE_CLASSES[size]}`}
        >
          <Crown
            size={ICON_SIZES[size]}
            strokeWidth={2.2}
            className="text-amber-600 dark:text-amber-300 shrink-0"
            aria-hidden="true"
          />
          <span>Dueño</span>
        </span>
      )}

      {showMemberBadge && badgeStyle && BadgeIcon && (
        <span
          title={`Insignia: ${cleanedBadge}`}
          className={`inline-flex items-center rounded-md border font-semibold tracking-wide whitespace-nowrap shrink-0 select-none transition-colors duration-300 ${badgeStyle.classes} ${SIZE_CLASSES[size]}`}
        >
          <BadgeIcon
            size={ICON_SIZES[size]}
            strokeWidth={2.2}
            className={`${badgeStyle.iconClass} shrink-0`}
            aria-hidden="true"
          />
          <span>{cleanedBadge}</span>
        </span>
      )}
    </>
  );
}
