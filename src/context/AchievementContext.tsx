import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Award, X } from 'lucide-react';
import { useAuth } from './AuthContext';
import {
  ACHIEVEMENT_BY_KEY,
  fetchReadingHistoryCount,
  fetchUserAchievements,
  insertUserAchievement,
  type AchievementDefinition,
  type AchievementKey,
  type UserAchievementRecord,
} from '../lib/phase3';
import { supabase } from '../lib/supabase';

interface AchievementContextValue {
  unlockedMap: Record<string, UserAchievementRecord>;
  unlockedCount: number;
  isLoadingAchievements: boolean;
  unlockByKeys: (keys: AchievementKey[]) => Promise<AchievementKey[]>;
  checkReadingHistoryAchievement: () => Promise<void>;
  checkArcadeAchievements: (params: {
    score: number;
    completedDailyChallenge: boolean;
  }) => Promise<void>;
  syncProfileAchievements: (silent?: boolean) => Promise<void>;
  refreshAchievements: () => Promise<void>;
}

const AchievementContext = createContext<AchievementContextValue | undefined>(
  undefined
);

export function AchievementProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [unlockedMap, setUnlockedMap] = useState<
    Record<string, UserAchievementRecord>
  >({});
  const [isLoadingAchievements, setIsLoadingAchievements] = useState(false);
  const [toastQueue, setToastQueue] = useState<AchievementDefinition[]>([]);
  const unlockedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    unlockedKeysRef.current = new Set(Object.keys(unlockedMap));
  }, [unlockedMap]);

  const enqueueToast = useCallback((defs: AchievementDefinition[]) => {
    if (defs.length === 0) return;
    setToastQueue((prev) => {
      const existing = new Set(prev.map((d) => d.key));
      const fresh = defs.filter((d) => !existing.has(d.key));
      return [...prev, ...fresh];
    });
  }, []);

  // Auto-oculta el toast activo tras 5 segundos
  const activeToast = toastQueue[0] ?? null;
  useEffect(() => {
    if (!activeToast) return;
    const timer = window.setTimeout(() => {
      setToastQueue((prev) => prev.slice(1));
    }, 5200);
    return () => window.clearTimeout(timer);
  }, [activeToast]);

  const refreshAchievements = useCallback(async () => {
    if (!user?.id) {
      setUnlockedMap({});
      unlockedKeysRef.current = new Set();
      return;
    }
    setIsLoadingAchievements(true);
    try {
      const list = await fetchUserAchievements(user.id);
      const nextMap: Record<string, UserAchievementRecord> = {};
      for (const item of list) {
        nextMap[item.achievement_key] = item;
      }
      setUnlockedMap(nextMap);
      unlockedKeysRef.current = new Set(Object.keys(nextMap));
    } catch {
      // Mantiene estado actual
    } finally {
      setIsLoadingAchievements(false);
    }
  }, [user?.id]);

  const unlockByKeys = useCallback(
    async (
      keys: AchievementKey[],
      options?: { silent?: boolean }
    ): Promise<AchievementKey[]> => {
      if (!user?.id || keys.length === 0) return [];

      const uniqueMissing = Array.from(new Set(keys)).filter(
        (key) => !unlockedKeysRef.current.has(key)
      );
      if (uniqueMissing.length === 0) return [];

      const newlyUnlocked: AchievementKey[] = [];
      const newRecords: Record<string, UserAchievementRecord> = {};

      for (const key of uniqueMissing) {
        // Previene duplicados en llamadas concurrentes
        unlockedKeysRef.current.add(key);
        const inserted = await insertUserAchievement(user.id, key);
        if (inserted) {
          newlyUnlocked.push(key);
          newRecords[key] = inserted;
        }
      }

      if (newlyUnlocked.length > 0) {
        setUnlockedMap((prev) => ({ ...prev, ...newRecords }));
        if (!options?.silent) {
          enqueueToast(newlyUnlocked.map((k) => ACHIEVEMENT_BY_KEY[k]));
        }
      }

      return newlyUnlocked;
    },
    [user?.id, enqueueToast]
  );

  const checkReadingHistoryAchievement = useCallback(async () => {
    if (!user?.id) return;
    if (unlockedKeysRef.current.has('bookworm_5')) return;
    const count = await fetchReadingHistoryCount(user.id);
    if (count >= 5) {
      await unlockByKeys(['bookworm_5']);
    }
  }, [user?.id, unlockByKeys]);

  const checkArcadeAchievements = useCallback(
    async (params: { score: number; completedDailyChallenge: boolean }) => {
      if (!user?.id) return;
      const toUnlock: AchievementKey[] = ['arcade_rookie'];
      if (params.score >= 500) toUnlock.push('arcade_500');
      if (params.score >= 1500) toUnlock.push('arcade_1500');
      if (params.completedDailyChallenge) toUnlock.push('daily_challenger');
      await unlockByKeys(toUnlock);
    },
    [user?.id, unlockByKeys]
  );

  const syncProfileAchievements = useCallback(
    async (silent = false) => {
      if (!user?.id) return;

      const checks: Promise<AchievementKey | null>[] = [];

      if (!unlockedKeysRef.current.has('first_post')) {
        checks.push(
          Promise.resolve(
            supabase
              .from('posts')
              .select('*', { count: 'exact', head: true })
              .eq('author_id', user.id)
          ).then(({ count }) => ((count ?? 0) >= 1 ? 'first_post' : null))
        );
      }

      if (!unlockedKeysRef.current.has('first_comment')) {
        checks.push(
          Promise.resolve(
            supabase
              .from('comments')
              .select('*', { count: 'exact', head: true })
              .eq('author_id', user.id)
          ).then(({ count }) => ((count ?? 0) >= 1 ? 'first_comment' : null))
        );
      }

      if (!unlockedKeysRef.current.has('bookworm_5')) {
        checks.push(
          fetchReadingHistoryCount(user.id).then((count) =>
            count >= 5 ? 'bookworm_5' : null
          )
        );
      }

      if (!unlockedKeysRef.current.has('social_5_followers')) {
        checks.push(
          Promise.resolve(
            supabase
              .from('user_follows')
              .select('*', { count: 'exact', head: true })
              .eq('following_id', user.id)
          ).then(({ count }) =>
            (count ?? 0) >= 5 ? 'social_5_followers' : null
          )
        );
      }

      const needsArcadeCheck =
        !unlockedKeysRef.current.has('arcade_rookie') ||
        !unlockedKeysRef.current.has('arcade_500') ||
        !unlockedKeysRef.current.has('arcade_1500');

      const [baseResults, arcadeScoresRes] = await Promise.all([
        Promise.all(checks),
        needsArcadeCheck
          ? supabase
              .from('arcade_scores')
              .select('score')
              .eq('user_id', user.id)
          : Promise.resolve({ data: null }),
      ]);

      const earned = baseResults.filter((k): k is AchievementKey => Boolean(k));

      if (arcadeScoresRes.data && arcadeScoresRes.data.length > 0) {
        let maxScore = 0;
        for (const row of arcadeScoresRes.data as Array<{ score: number }>) {
          const val = Number(row.score) || 0;
          if (val > maxScore) maxScore = val;
        }
        earned.push('arcade_rookie');
        if (maxScore >= 500) earned.push('arcade_500');
        if (maxScore >= 1500) earned.push('arcade_1500');
      }

      if (earned.length > 0) {
        await unlockByKeys(earned, { silent });
      }
    },
    [user?.id, unlockByKeys]
  );

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setUnlockedMap({});
      unlockedKeysRef.current = new Set();
      return;
    }
    let active = true;
    void (async () => {
      await refreshAchievements();
      if (active) {
        await syncProfileAchievements(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.id, refreshAchievements, syncProfileAchievements]);

  const value = useMemo<AchievementContextValue>(
    () => ({
      unlockedMap,
      unlockedCount: Object.keys(unlockedMap).length,
      isLoadingAchievements,
      unlockByKeys: (keys) => unlockByKeys(keys, { silent: false }),
      checkReadingHistoryAchievement,
      checkArcadeAchievements,
      syncProfileAchievements,
      refreshAchievements,
    }),
    [
      unlockedMap,
      isLoadingAchievements,
      unlockByKeys,
      checkReadingHistoryAchievement,
      checkArcadeAchievements,
      syncProfileAchievements,
      refreshAchievements,
    ]
  );

  return (
    <AchievementContext.Provider value={value}>
      {children}

      {/* Notificación visual flotante al desbloquear un logro (ubicada arriba a la derecha para no chocar con controles inferiores) */}
      {activeToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 right-4 z-50 w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-amber-500/45 bg-[var(--bg-card)] p-4 shadow-2xl transition-all duration-300"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/15 text-amber-600 dark:text-amber-300">
              <Award size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-amber-600 dark:text-amber-300">
                ¡Logro desbloqueado!
              </p>
              <p className="mt-0.5 font-display text-sm font-bold text-[var(--text-main)]">
                {activeToast.title}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {activeToast.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToastQueue((prev) => prev.slice(1))}
              aria-label="Cerrar aviso de logro"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </AchievementContext.Provider>
  );
}

export function useAchievements() {
  const ctx = useContext(AchievementContext);
  if (!ctx) {
    throw new Error(
      'useAchievements debe usarse dentro de un AchievementProvider.'
    );
  }
  return ctx;
}
