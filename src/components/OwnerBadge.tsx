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
        'border-fuchsia-500/45 bg-gradient-to-r from-violet-500/18 to-fuchsia-500/18 text-fuchsia-700 dark:border-fuchsia-400/45 dark:from-violet-500/25 dark:to-fuchsia-500/25 dark:text-fuchsia-200',
      iconClass: 'text-fuchsia-600 dark:text-fuchsia-300',
    };
  }
  if (normalized === 'autor verificado') {
    return {
      Icon: BadgeCheck,
      classes:
        'border-cyan-500/45 bg-gradient-to-r from-cyan-500/16 to-sky-500/16 text-cyan-700 dark:border-cyan-400/45 dark:from-cyan-500/22 dark:to-sky-500/22 dark:text-cyan-200',
      iconClass: 'text-cyan-600 dark:text-cyan-300',
    };
  }
  if (normalized === 'moderador') {
    return {
      Icon: ShieldCheck,
      classes:
        'border-emerald-500/45 bg-gradient-to-r from-emerald-500/16 to-teal-500/16 text-emerald-700 dark:border-emerald-400/45 dark:from-emerald-500/22 dark:to-teal-500/22 dark:text-emerald-200',
      iconClass: 'text-emerald-600 dark:text-emerald-300',
    };
  }
  return {
    Icon: Award,
    classes:
      'border-indigo-500/40 bg-indigo-500/14 text-indigo-700 dark:border-indigo-400/40 dark:bg-indigo-500/20 dark:text-indigo-200',
    iconClass: 'text-indigo-600 dark:text-indigo-300',
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
          className={`inline-flex items-center rounded-md border border-amber-500/50 bg-gradient-to-r from-amber-500/20 to-orange-500/18 font-bold tracking-wide text-amber-800 dark:border-amber-400/45 dark:from-amber-400/22 dark:to-orange-500/22 dark:text-amber-200 whitespace-nowrap shrink-0 select-none transition-colors duration-300 ${SIZE_CLASSES[size]}`}
        >
          <Crown
            size={ICON_SIZES[size]}
            strokeWidth={2.3}
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
