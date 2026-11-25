import { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  CalendarCheck2,
  Flame,
  Gamepad2,
  Lock,
  MessageSquare,
  PenSquare,
  Trophy,
  Users,
} from 'lucide-react';
import {
  ACHIEVEMENT_CATALOG,
  fetchUserAchievements,
  type AchievementDefinition,
  type AchievementKey,
  type UserAchievementRecord,
} from '../lib/phase3';
import { formatEditorialDate } from '../lib/posts';

interface AchievementsShowcaseProps {
  userId: string;
  heading?: string;
  preloadedMap?: Record<string, UserAchievementRecord>;
}

function AchievementIcon({
  achievementKey,
  unlocked,
}: {
  achievementKey: AchievementKey;
  unlocked: boolean;
}) {
  const size = 18;
  const props = { size, 'aria-hidden': true as const };

  if (!unlocked) {
    return <Lock size={16} aria-hidden="true" />;
  }

  switch (achievementKey) {
    case 'first_post':
      return <PenSquare {...props} />;
    case 'first_comment':
      return <MessageSquare {...props} />;
    case 'bookworm_5':
      return <BookOpen {...props} />;
    case 'arcade_rookie':
      return <Gamepad2 {...props} />;
    case 'arcade_500':
      return <Flame {...props} />;
    case 'arcade_1500':
      return <Trophy {...props} />;
    case 'daily_challenger':
      return <CalendarCheck2 {...props} />;
    case 'social_5_followers':
      return <Users {...props} />;
    default:
      return <Award {...props} />;
  }
}

function getTierStyles(tier: AchievementDefinition['tier'], unlocked: boolean) {
  if (!unlocked) {
    return {
      card: 'border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 opacity-75',
      icon: 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-muted)]',
      label: 'text-[var(--text-muted)]',
    };
  }
  if (tier === 'gold') {
    return {
      card: 'border-amber-500/40 bg-amber-500/[0.06]',
      icon: 'border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-300',
      label: 'text-amber-600 dark:text-amber-300',
    };
  }
  if (tier === 'silver') {
    return {
      card: 'border-[var(--accent-border)] bg-[var(--accent-soft)]/70',
      icon: 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]',
      label: 'text-[var(--accent-primary)]',
    };
  }
  return {
    card: 'border-emerald-500/35 bg-emerald-500/[0.06]',
    icon: 'border-emerald-500/35 bg-emerald-500/14 text-emerald-600 dark:text-emerald-300',
    label: 'text-emerald-600 dark:text-emerald-300',
  };
}

export function AchievementsShowcase({
  userId,
  heading = 'Vitrina de Logros',
  preloadedMap,
}: AchievementsShowcaseProps) {
  const [fetchedMap, setFetchedMap] = useState<
    Record<string, UserAchievementRecord>
  >({});
  const [isLoading, setIsLoading] = useState(!preloadedMap);

  useEffect(() => {
    if (preloadedMap) {
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    fetchUserAchievements(userId)
      .then((list) => {
        if (!active) return;
        const map: Record<string, UserAchievementRecord> = {};
        for (const item of list) {
          map[item.achievement_key] = item;
        }
        setFetchedMap(map);
      })
      .catch(() => {
        if (active) setFetchedMap({});
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, preloadedMap]);

  const activeMap = preloadedMap ?? fetchedMap;
  const totalCount = ACHIEVEMENT_CATALOG.length;
  const unlockedCount = ACHIEVEMENT_CATALOG.filter((def) =>
    Boolean(activeMap[def.key])
  ).length;
  const progressPct = Math.round((unlockedCount / totalCount) * 100);

  return (
    <section
      aria-label={heading}
      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-sm transition-colors duration-300"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/12 text-amber-600 dark:text-amber-300">
            <Award size={18} aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-[var(--text-main)]">
              {heading}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Medallas desbloqueables por participar, leer y competir en Trama.
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="font-display text-base font-bold tabular-nums text-[var(--text-main)]">
            {unlockedCount} / {totalCount}
          </p>
          <p className="text-[11px] tabular-nums text-[var(--text-muted)]">
            {progressPct}% completado
          </p>
        </div>
      </div>

      {/* Barra de progreso general de logros */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
        <div
          style={{
            transform: `scaleX(${progressPct / 100})`,
            transformOrigin: 'left center',
          }}
          className="h-full w-full rounded-full bg-[var(--accent-primary)] transition-transform duration-500 ease-out"
        />
      </div>

      {isLoading ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 animate-pulse">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-20 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ACHIEVEMENT_CATALOG.map((def) => {
            const record = activeMap[def.key];
            const unlocked = Boolean(record);
            const styles = getTierStyles(def.tier, unlocked);

            return (
              <div
                key={def.key}
                className={`flex items-start gap-3 rounded-xl border p-3.5 transition-colors duration-300 ${styles.card}`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles.icon}`}
                >
                  <AchievementIcon
                    achievementKey={def.key}
                    unlocked={unlocked}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <h3 className="truncate font-display text-sm font-bold text-[var(--text-main)]">
                      {def.title}
                    </h3>
                    <span className={`text-[10px] font-semibold ${styles.label}`}>
                      {unlocked ? 'Desbloqueado' : def.category}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {def.description}
                  </p>
                  {record?.unlocked_at && (
                    <p className="mt-1 text-[10px] tabular-nums text-[var(--text-muted)]">
                      Conseguido el {formatEditorialDate(record.unlocked_at)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
