import { useEffect, useState } from 'react';
import {
  BookOpen,
  Eye,
  FileText,
  PenTool,
  Star,
  Users,
} from 'lucide-react';
import { fetchWriterStats, type WriterStats } from '../lib/phase2';

interface WriterStatsCardProps {
  userId: string;
  heading?: string;
}

export function WriterStatsCard({
  userId,
  heading = 'Estadísticas de Escritor',
}: WriterStatsCardProps) {
  const [stats, setStats] = useState<WriterStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    fetchWriterStats(userId)
      .then((data) => {
        if (active) setStats(data);
      })
      .catch(() => {
        if (active) setStats(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const totalPublished = stats
    ? stats.totalSeries + stats.totalArticles + stats.totalCommunityPosts
    : 0;

  return (
    <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 transition-colors duration-300">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <PenTool className="w-4 h-4 text-[var(--accent-primary)]" />
          <h3 className="text-sm font-semibold text-[var(--text-main)]">
            {heading}
          </h3>
        </div>
        {stats && stats.totalSeries > 0 && (
          <span className="text-[11px] font-medium text-[var(--text-muted)]">
            {stats.totalSeries}{' '}
            {stats.totalSeries === 1 ? 'obra en Biblioteca' : 'obras en Biblioteca'}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
            />
          ))}
        </div>
      ) : !stats ? (
        <p className="text-xs text-[var(--text-muted)]">
          No se pudieron cargar las métricas de escritura en este momento.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mb-1">
              <FileText className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Publicaciones</span>
            </div>
            <p className="text-xl font-bold text-[var(--text-main)] tabular-nums">
              {totalPublished}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
              {stats.totalArticles} art. · {stats.totalSeries} obras
            </p>
          </div>

          <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mb-1">
              <BookOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Capítulos</span>
            </div>
            <p className="text-xl font-bold text-[var(--text-main)] tabular-nums">
              {stats.totalChapters}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              escritos
            </p>
          </div>

          <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mb-1">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span>Calificación</span>
            </div>
            <p className="text-xl font-bold text-[var(--text-main)] tabular-nums">
              {stats.averageRating !== null
                ? stats.averageRating.toFixed(1)
                : '—'}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              {stats.totalRatingsCount > 0
                ? `${stats.totalRatingsCount} ${
                    stats.totalRatingsCount === 1 ? 'voto' : 'votos'
                  }`
                : 'sin votos aún'}
            </p>
          </div>

          <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mb-1">
              <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Seguidores</span>
            </div>
            <p className="text-xl font-bold text-[var(--text-main)] tabular-nums">
              {stats.totalFollowers}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              lectores
            </p>
          </div>

          <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-3 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mb-1">
              <Eye className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Lecturas</span>
            </div>
            <p className="text-xl font-bold text-[var(--text-main)] tabular-nums">
              {stats.totalViews.toLocaleString('es-ES')}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              acumuladas
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
