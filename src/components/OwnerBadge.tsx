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
      classes: 'border-violet-400/40 bg-violet-500/15 text-violet-200',
      iconClass: 'text-violet-300',
    };
  }
  if (normalized === 'autor verificado') {
    return {
      Icon: BadgeCheck,
      classes: 'border-sky-400/40 bg-sky-500/15 text-sky-200',
      iconClass: 'text-sky-300',
    };
  }
  if (normalized === 'moderador') {
    return {
      Icon: ShieldCheck,
      classes: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
      iconClass: 'text-emerald-300',
    };
  }
  return {
    Icon: Award,
    classes: 'border-white/20 bg-white/10 text-[#DCE3F0]',
    iconClass: 'text-[#9EC5FF]',
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
          className={`inline-flex items-center rounded-md border border-amber-400/40 bg-amber-400/15 font-semibold tracking-wide text-amber-300 whitespace-nowrap shrink-0 select-none ${SIZE_CLASSES[size]}`}
        >
          <Crown
            size={ICON_SIZES[size]}
            strokeWidth={2.2}
            className="text-amber-300 shrink-0"
            aria-hidden="true"
          />
          <span>Dueño</span>
        </span>
      )}

      {showMemberBadge && badgeStyle && BadgeIcon && (
        <span
          title={`Insignia: ${cleanedBadge}`}
          className={`inline-flex items-center rounded-md border font-semibold tracking-wide whitespace-nowrap shrink-0 select-none ${badgeStyle.classes} ${SIZE_CLASSES[size]}`}
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
