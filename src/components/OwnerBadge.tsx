import { Crown } from 'lucide-react';
import { isOwnerRole } from '../lib/supabase';

interface OwnerBadgeProps {
  role?: string | null;
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

export function OwnerBadge({ role, size = 'sm' }: OwnerBadgeProps) {
  if (!isOwnerRole(role)) return null;

  return (
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
  );
}
