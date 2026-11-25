import { BadgeCheck } from 'lucide-react';

interface VerifiedBadgeProps {
  compact?: boolean;
}

export function VerifiedBadge({ compact = false }: VerifiedBadgeProps) {
  return (
    <span
      title="Noticia revisada y verificada por el equipo editorial de Trama"
      className={`inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/12 font-semibold text-emerald-400 tracking-wide transition-colors duration-300 ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      }`}
    >
      <BadgeCheck className={compact ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
      Verificada
    </span>
  );
}
