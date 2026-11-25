import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  fetchFollowCounts,
  fetchFollowingIds,
  fetchSavedPostIds,
  fetchSeriesCollections,
  followUser,
  removePostFromCollection,
  savePostToCollection,
  saveSeriesCollectionEntry,
  unfollowUser,
  type FollowCounts,
  type ReadingStatus,
  type SeriesCollectionEntry,
} from '../lib/social';

interface SocialContextValue {
  followingIds: Set<string>;
  savedPostIds: string[];
  seriesCollections: Record<string, SeriesCollectionEntry>;
  myFollowCounts: FollowCounts;
  isLoadingSocial: boolean;
  socialError: string | null;
  busyFollowIds: Record<string, boolean>;
  busySavePostIds: Record<string, boolean>;
  busySeriesIds: Record<string, boolean>;
  clearSocialError: () => void;
  isFollowing: (targetUserId: string | null | undefined) => boolean;
  isPostSaved: (postId: string) => boolean;
  getSeriesCollection: (seriesId: string) => SeriesCollectionEntry | null;
  toggleFollow: (targetUserId: string) => Promise<boolean>;
  toggleSavePost: (postId: string) => Promise<boolean>;
  setSeriesStatus: (
    seriesId: string,
    status: ReadingStatus | null
  ) => Promise<void>;
  toggleSeriesFavorite: (seriesId: string) => Promise<void>;
  refreshSocial: () => Promise<void>;
}

const SocialContext = createContext<SocialContextValue | undefined>(undefined);

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  const [followingList, setFollowingList] = useState<string[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  const [seriesCollections, setSeriesCollections] = useState<
    Record<string, SeriesCollectionEntry>
  >({});
  const [myFollowCounts, setMyFollowCounts] = useState<FollowCounts>({
    followers: 0,
    following: 0,
  });
  const [isLoadingSocial, setIsLoadingSocial] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);

  const [busyFollowIds, setBusyFollowIds] = useState<Record<string, boolean>>(
    {}
  );
  const [busySavePostIds, setBusySavePostIds] = useState<
    Record<string, boolean>
  >({});
  const [busySeriesIds, setBusySeriesIds] = useState<Record<string, boolean>>(
    {}
  );

  const followingIds = useMemo(() => new Set(followingList), [followingList]);
  const savedPostIdSet = useMemo(() => new Set(savedPostIds), [savedPostIds]);

  const refreshSocial = useCallback(async () => {
    if (!user?.id) {
      setFollowingList([]);
      setSavedPostIds([]);
      setSeriesCollections({});
      setMyFollowCounts({ followers: 0, following: 0 });
      setSocialError(null);
      return;
    }

    setIsLoadingSocial(true);
    try {
      const [followsRes, countsRes, savedPostsRes, seriesColRes] =
        await Promise.allSettled([
          fetchFollowingIds(user.id),
          fetchFollowCounts(user.id),
          fetchSavedPostIds(user.id),
          fetchSeriesCollections(user.id),
        ]);

      if (followsRes.status === 'fulfilled') {
        setFollowingList(followsRes.value);
      }
      if (countsRes.status === 'fulfilled') {
        setMyFollowCounts(countsRes.value);
      } else if (followsRes.status === 'fulfilled') {
        setMyFollowCounts((prev) => ({
          ...prev,
          following: followsRes.value.length,
        }));
      }
      if (savedPostsRes.status === 'fulfilled') {
        setSavedPostIds(savedPostsRes.value);
      }
      if (seriesColRes.status === 'fulfilled') {
        setSeriesCollections(seriesColRes.value);
      }
    } finally {
      setIsLoadingSocial(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setFollowingList([]);
      setSavedPostIds([]);
      setSeriesCollections({});
      setMyFollowCounts({ followers: 0, following: 0 });
      return;
    }
    void refreshSocial();
  }, [isAuthenticated, user?.id, refreshSocial]);

  const isFollowing = useCallback(
    (targetUserId: string | null | undefined) => {
      if (!targetUserId) return false;
      return followingIds.has(targetUserId);
    },
    [followingIds]
  );

  const isPostSaved = useCallback(
    (postId: string) => savedPostIdSet.has(postId),
    [savedPostIdSet]
  );

  const getSeriesCollection = useCallback(
    (seriesId: string) => seriesCollections[seriesId] ?? null,
    [seriesCollections]
  );

  const toggleFollow = useCallback(
    async (targetUserId: string): Promise<boolean> => {
      if (!user?.id || !targetUserId || user.id === targetUserId) {
        return false;
      }
      if (busyFollowIds[targetUserId]) {
        return followingIds.has(targetUserId);
      }

      const currentlyFollowing = followingIds.has(targetUserId);
      const nextFollowing = !currentlyFollowing;

      setSocialError(null);
      setBusyFollowIds((prev) => ({ ...prev, [targetUserId]: true }));
      setFollowingList((prev) =>
        nextFollowing
          ? Array.from(new Set([...prev, targetUserId]))
          : prev.filter((id) => id !== targetUserId)
      );
      setMyFollowCounts((prev) => ({
        ...prev,
        following: Math.max(0, prev.following + (nextFollowing ? 1 : -1)),
      }));

      try {
        if (nextFollowing) {
          await followUser(user.id, targetUserId);
        } else {
          await unfollowUser(user.id, targetUserId);
        }
        return nextFollowing;
      } catch (err) {
        // Revertir estado optimista si Supabase rechaza la operación
        setFollowingList((prev) =>
          currentlyFollowing
            ? Array.from(new Set([...prev, targetUserId]))
            : prev.filter((id) => id !== targetUserId)
        );
        setMyFollowCounts((prev) => ({
          ...prev,
          following: Math.max(0, prev.following + (currentlyFollowing ? 1 : -1)),
        }));
        setSocialError(
          err instanceof Error
            ? err.message
            : 'No se pudo actualizar el seguimiento.'
        );
        return currentlyFollowing;
      } finally {
        setBusyFollowIds((prev) => ({ ...prev, [targetUserId]: false }));
      }
    },
    [user?.id, busyFollowIds, followingIds]
  );

  const toggleSavePost = useCallback(
    async (postId: string): Promise<boolean> => {
      if (!user?.id || !postId) return false;
      if (busySavePostIds[postId]) {
        return savedPostIdSet.has(postId);
      }

      const currentlySaved = savedPostIdSet.has(postId);
      const nextSaved = !currentlySaved;

      setSocialError(null);
      setBusySavePostIds((prev) => ({ ...prev, [postId]: true }));
      setSavedPostIds((prev) =>
        nextSaved
          ? [postId, ...prev.filter((id) => id !== postId)]
          : prev.filter((id) => id !== postId)
      );

      try {
        if (nextSaved) {
          await savePostToCollection(user.id, postId);
        } else {
          await removePostFromCollection(user.id, postId);
        }
        return nextSaved;
      } catch (err) {
        setSavedPostIds((prev) =>
          currentlySaved
            ? [postId, ...prev.filter((id) => id !== postId)]
            : prev.filter((id) => id !== postId)
        );
        setSocialError(
          err instanceof Error
            ? err.message
            : 'No se pudo actualizar tu lista de guardados.'
        );
        return currentlySaved;
      } finally {
        setBusySavePostIds((prev) => ({ ...prev, [postId]: false }));
      }
    },
    [user?.id, busySavePostIds, savedPostIdSet]
  );

  const setSeriesStatus = useCallback(
    async (seriesId: string, status: ReadingStatus | null) => {
      if (!user?.id || !seriesId || busySeriesIds[seriesId]) return;
      const current = seriesCollections[seriesId];
      const nextFavorite = Boolean(current?.is_favorite);
      const now = new Date().toISOString();

      setSocialError(null);
      setBusySeriesIds((prev) => ({ ...prev, [seriesId]: true }));
      setSeriesCollections((prev) => {
        const next = { ...prev };
        if (!status && !nextFavorite) {
          delete next[seriesId];
        } else {
          next[seriesId] = {
            series_id: seriesId,
            status,
            is_favorite: nextFavorite,
            updated_at: now,
          };
        }
        return next;
      });

      try {
        await saveSeriesCollectionEntry(user.id, seriesId, status, nextFavorite);
      } catch (err) {
        setSocialError(
          err instanceof Error
            ? err.message
            : 'No se pudo actualizar el estado de lectura.'
        );
      } finally {
        setBusySeriesIds((prev) => ({ ...prev, [seriesId]: false }));
      }
    },
    [user?.id, busySeriesIds, seriesCollections]
  );

  const toggleSeriesFavorite = useCallback(
    async (seriesId: string) => {
      if (!user?.id || !seriesId || busySeriesIds[seriesId]) return;
      const current = seriesCollections[seriesId];
      const nextFavorite = !Boolean(current?.is_favorite);
      const nextStatus = current?.status ?? null;
      const now = new Date().toISOString();

      setSocialError(null);
      setBusySeriesIds((prev) => ({ ...prev, [seriesId]: true }));
      setSeriesCollections((prev) => {
        const next = { ...prev };
        if (!nextStatus && !nextFavorite) {
          delete next[seriesId];
        } else {
          next[seriesId] = {
            series_id: seriesId,
            status: nextStatus,
            is_favorite: nextFavorite,
            updated_at: now,
          };
        }
        return next;
      });

      try {
        await saveSeriesCollectionEntry(
          user.id,
          seriesId,
          nextStatus,
          nextFavorite
        );
      } catch (err) {
        setSocialError(
          err instanceof Error
            ? err.message
            : 'No se pudo actualizar favoritos.'
        );
      } finally {
        setBusySeriesIds((prev) => ({ ...prev, [seriesId]: false }));
      }
    },
    [user?.id, busySeriesIds, seriesCollections]
  );

  const value = useMemo<SocialContextValue>(
    () => ({
      followingIds,
      savedPostIds,
      seriesCollections,
      myFollowCounts,
      isLoadingSocial,
      socialError,
      busyFollowIds,
      busySavePostIds,
      busySeriesIds,
      clearSocialError: () => setSocialError(null),
      isFollowing,
      isPostSaved,
      getSeriesCollection,
      toggleFollow,
      toggleSavePost,
      setSeriesStatus,
      toggleSeriesFavorite,
      refreshSocial,
    }),
    [
      followingIds,
      savedPostIds,
      seriesCollections,
      myFollowCounts,
      isLoadingSocial,
      socialError,
      busyFollowIds,
      busySavePostIds,
      busySeriesIds,
      isFollowing,
      isPostSaved,
      getSeriesCollection,
      toggleFollow,
      toggleSavePost,
      setSeriesStatus,
      toggleSeriesFavorite,
      refreshSocial,
    ]
  );

  return (
    <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
  );
}

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) {
    throw new Error('useSocial debe usarse dentro de un SocialProvider.');
  }
  return ctx;
}
