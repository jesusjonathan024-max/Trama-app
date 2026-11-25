import { useState } from 'react';
import { Loader2, Star } from 'lucide-react';

interface StarRatingProps {
  average: number;
  count: number;
  userRating?: number | null;
  interactive?: boolean;
  isSubmitting?: boolean;
  compact?: boolean;
  onRate?: (value: number) => void;
}

export function StarRating({
  average,
  count,
  userRating = null,
  interactive = false,
  isSubmitting = false,
  compact = false,
  onRate,
}: StarRatingProps) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  if (!interactive) {
    const rounded = Math.round(average);
    return (
      <div
        className={`inline-flex items-center gap-1.5 ${
          compact ? 'text-[11px]' : 'text-xs'
        }`}
        aria-label={
          count > 0
            ? `Calificación promedio ${average.toFixed(1)} de 5 con ${count} votos`
            : 'Sin calificaciones todavía'
        }
      >
        <span className="inline-flex items-center gap-0.5 text-amber-400">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${
                star <= rounded
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-[var(--text-muted)] opacity-45'
              }`}
            />
          ))}
        </span>
        {count > 0 ? (
          <span className="font-semibold text-[var(--text-main)] tabular-nums">
            {average.toFixed(1)}
            <span className="font-normal text-[var(--text-muted)] ml-1">
              ({count})
            </span>
          </span>
        ) : (
          <span className="text-[var(--text-muted)]">Sin votos</span>
        )}
      </div>
    );
  }

  const activeLevel = hoveredStar ?? userRating ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= activeLevel;
          return (
            <button
              key={star}
              type="button"
              disabled={isSubmitting}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(null)}
              onFocus={() => setHoveredStar(star)}
              onBlur={() => setHoveredStar(null)}
              onClick={() => onRate?.(star)}
              aria-label={`Calificar con ${star} ${
                star === 1 ? 'estrella' : 'estrellas'
              }`}
              className="p-1 rounded-md transition-transform duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-50"
            >
              <Star
                className={`w-5 h-5 transition-colors ${
                  isFilled
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-[var(--text-muted)] hover:text-amber-300'
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        {isSubmitting ? (
          <span className="inline-flex items-center gap-1.5 text-[var(--accent-primary)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Guardando voto...
          </span>
        ) : (
          <>
            <span className="font-semibold text-[var(--text-main)] tabular-nums">
              {count > 0 ? `${average.toFixed(1)} / 5` : 'Sé el primero en calificar'}
            </span>
            {count > 0 && (
              <span className="text-[var(--text-muted)]">
                ({count} {count === 1 ? 'voto' : 'votos'})
              </span>
            )}
            {userRating !== null && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-400">
                Tu voto: {userRating}★
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
