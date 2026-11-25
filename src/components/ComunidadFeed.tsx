import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  Check,
  Clock,
  Compass,
  Flag,
  Flame,
  Hash,
  Heart,
  MessageSquare,
  PenSquare,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocial } from '../context/SocialContext';
import {
  formatHashtagDisplay,
  getPopularHashtags,
  normalizeHashtag,
  postHasHashtag,
} from '../lib/hashtags';
import { fetchUserReportedPostIds } from '../lib/phase2';
import { fetchPollsByPostIds, type PostPollData } from '../lib/phase3';
import {
  fetchCommunities,
  joinCommunity,
  leaveCommunity,
  type CommunityRecord,
} from '../lib/phase4';
import {
  COMUNIDAD_CATEGORIES,
  deletePost,
  estimateReadMinutes,
  fetchPostsByMode,
  formatRelativeDate,
  getAuthorDisplayName,
  sortPostsWithPinnedFirst,
  togglePostLike,
  togglePostPin,
  type PostRecord,
} from '../lib/posts';
import { sortPostsByMode, type FeedSortMode } from '../lib/social';
import { Avatar } from './Avatar';
import { CreateCommunityModal } from './CreateCommunityModal';
import { EditPostModal } from './EditPostModal';
import { FollowButton } from './FollowButton';
import { HashtagText } from './HashtagText';
import { MediaImage } from './MediaImage';
import { OwnerBadge } from './OwnerBadge';
import { PollCard } from './PollCard';
import { ReportPostModal } from './ReportPostModal';

interface ComunidadFeedProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  selectedHashtag: string | null;
  onSelectHashtag: (tag: string | null) => void;
  selectedCommunityId: string | null;
  onSelectCommunityId: (communityId: string | null) => void;
  refreshKey: number;
  syncedPostUpdate: PostRecord | null;
  deletedPostId: string | null;
  onSelectPost: (post: PostRecord) => void;
  onOpenAuthorProfile: (authorId: string) => void;
  onOpenAuth: () => void;
  onOpenCreate: () => void;
  onOpenAssistant: () => void;
}

const FILTER_OPTIONS = ['Todos', 'Siguiendo', ...COMUNIDAD_CATEGORIES] as const;

export function ComunidadFeed({
  selectedCategory,
  onSelectCategory,
  selectedHashtag,
  onSelectHashtag,
  selectedCommunityId,
  onSelectCommunityId,
  refreshKey,
  syncedPostUpdate,
  deletedPostId,
  onSelectPost,
  onOpenAuthorProfile,
  onOpenAuth,
  onOpenCreate,
  onOpenAssistant,
}: ComunidadFeedProps) {
  const { user, isAuthenticated, isOwner } = useAuth();
  const { followingIds, isPostSaved, busySavePostIds, toggleSavePost } =
    useSocial();
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [communities, setCommunities] = useState<CommunityRecord[]>([]);
  const [isLoadingCommunities, setIsLoadingCommunities] = useState(true);
  const [busyCommunityIds, setBusyCommunityIds] = useState<
    Record<string, boolean>
  >({});
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [sortMode, setSortMode] = useState<FeedSortMode>('recent');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [likingIds, setLikingIds] = useState<Record<string, boolean>>({});
  const [pinningIds, setPinningIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<PostRecord | null>(null);
  const [reportedPostIds, setReportedPostIds] = useState<Set<string>>(
    () => new Set()
  );
  const [reportingPost, setReportingPost] = useState<PostRecord | null>(null);
  const [pollsByPostId, setPollsByPostId] = useState<
    Record<string, PostPollData>
  >({});

  const loadCommunitiesList = useCallback(async () => {
    setIsLoadingCommunities(true);
    try {
      const list = await fetchCommunities(user?.id);
      setCommunities(list);
    } catch {
      // Mantiene lista actual si falla lectura auxiliar
    } finally {
      setIsLoadingCommunities(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadCommunitiesList();
  }, [loadCommunitiesList, refreshKey]);

  const loadThreads = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchPostsByMode('comunidad', user?.id);
      setPosts(data);
      if (data.length > 0) {
        fetchPollsByPostIds(
          data.map((p) => p.id),
          user?.id
        )
          .then((map) => setPollsByPostId(map))
          .catch(() => {
            // Ignora fallo auxiliar al cargar encuestas
          });
      } else {
        setPollsByPostId({});
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los hilos de Comunidad.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads, refreshKey]);

  useEffect(() => {
    if (!user?.id) {
      setReportedPostIds(new Set());
      return;
    }
    fetchUserReportedPostIds(user.id)
      .then((ids) => setReportedPostIds(new Set(ids)))
      .catch(() => {
        // Ignora error auxiliar
      });
  }, [user?.id]);

  useEffect(() => {
    if (!syncedPostUpdate || syncedPostUpdate.mode !== 'comunidad') return;
    setPosts((prev) =>
      sortPostsWithPinnedFirst(
        prev.map((item) =>
          item.id === syncedPostUpdate.id ? syncedPostUpdate : item
        )
      )
    );
  }, [syncedPostUpdate]);

  useEffect(() => {
    if (!deletedPostId) return;
    setPosts((prev) => prev.filter((item) => item.id !== deletedPostId));
  }, [deletedPostId]);

  const communitiesById = useMemo(
    () => new Map(communities.map((c) => [c.id, c])),
    [communities]
  );

  const activeCommunity = selectedCommunityId
    ? communitiesById.get(selectedCommunityId) ?? null
    : null;

  const popularHashtags = useMemo(() => getPopularHashtags(posts, 10), [posts]);

  const filteredPosts = useMemo(() => {
    let base = posts;

    if (selectedCommunityId) {
      base = base.filter((post) => post.community_id === selectedCommunityId);
    }

    if (selectedCategory === 'Siguiendo') {
      base = base.filter((post) => followingIds.has(post.author_id));
    } else if (selectedCategory !== 'Todos') {
      base = base.filter((post) => post.category === selectedCategory);
    }

    if (selectedHashtag) {
      base = base.filter((post) => postHasHashtag(post, selectedHashtag));
    }

    return sortPostsByMode(base, sortMode);
  }, [
    posts,
    selectedCommunityId,
    selectedCategory,
    followingIds,
    selectedHashtag,
    sortMode,
  ]);

  async function handleToggleCommunityMembership(comm: CommunityRecord) {
    if (!isAuthenticated || !user) {
      onOpenAuth();
      return;
    }
    if (busyCommunityIds[comm.id]) return;

    const nextMember = !comm.is_member;
    setBusyCommunityIds((prev) => ({ ...prev, [comm.id]: true }));
    setCommunities((prev) =>
      prev.map((item) =>
        item.id === comm.id
          ? {
              ...item,
              is_member: nextMember,
              members_count: Math.max(
                0,
                item.members_count + (nextMember ? 1 : -1)
              ),
            }
          : item
      )
    );

    try {
      if (nextMember) {
        await joinCommunity(comm.id, user.id);
      } else {
        await leaveCommunity(comm.id, user.id);
      }
    } catch (err) {
      setCommunities((prev) =>
        prev.map((item) => (item.id === comm.id ? comm : item))
      );
      setActionError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar tu membresía en la comunidad.'
      );
    } finally {
      setBusyCommunityIds((prev) => ({ ...prev, [comm.id]: false }));
    }
  }

  async function handleToggleSave(postId: string) {
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }
    await toggleSavePost(postId);
  }

  function handleSelectHashtagChip(tag: string) {
    const normalizedClicked = normalizeHashtag(tag);
    const normalizedActive = selectedHashtag
      ? normalizeHashtag(selectedHashtag)
      : '';
    if (normalizedClicked && normalizedClicked === normalizedActive) {
      onSelectHashtag(null);
    } else {
      onSelectHashtag(formatHashtagDisplay(tag));
    }
  }

  async function handleToggleLike(post: PostRecord) {
    if (!isAuthenticated || !user) {
      onOpenAuth();
      return;
    }
    if (likingIds[post.id]) return;

    const nextLiked = !post.liked_by_me;
    const nextCount = Math.max(0, post.likes_count + (nextLiked ? 1 : -1));

    setLikingIds((prev) => ({ ...prev, [post.id]: true }));
    setPosts((prev) =>
      prev.map((item) =>
        item.id === post.id
          ? { ...item, liked_by_me: nextLiked, likes_count: nextCount }
          : item
      )
    );

    try {
      await togglePostLike(post.id, user.id, post.liked_by_me);
    } catch {
      setPosts((prev) =>
        prev.map((item) =>
          item.id === post.id
            ? {
                ...item,
                liked_by_me: post.liked_by_me,
                likes_count: post.likes_count,
              }
            : item
        )
      );
    } finally {
      setLikingIds((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  async function handleTogglePin(post: PostRecord) {
    if (!isOwner || pinningIds[post.id]) return;
    setActionError(null);
    const nextPinned = !post.is_pinned;

    setPinningIds((prev) => ({ ...prev, [post.id]: true }));
    setPosts((prev) =>
      sortPostsWithPinnedFirst(
        prev.map((item) =>
          item.id === post.id ? { ...item, is_pinned: nextPinned } : item
        )
      )
    );

    try {
      await togglePostPin(post.id, nextPinned);
    } catch (err) {
      setPosts((prev) =>
        sortPostsWithPinnedFirst(
          prev.map((item) =>
            item.id === post.id
              ? { ...item, is_pinned: post.is_pinned }
              : item
          )
        )
      );
      setActionError(
        err instanceof Error
          ? err.message
          : 'No se pudo cambiar el estado de fijado.'
      );
    } finally {
      setPinningIds((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  async function handleConfirmDelete(postId: string) {
    if (!user) return;
    setDeletingId(postId);
    setActionError(null);
    try {
      await deletePost(postId, user.id, isOwner);
      setPosts((prev) => prev.filter((item) => item.id !== postId));
      setConfirmDeleteId(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'No se pudo eliminar el hilo.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  function handleEditedSaved(updated: PostRecord) {
    setPosts((prev) =>
      sortPostsWithPinnedFirst(
        prev.map((item) => (item.id === updated.id ? updated : item))
      )
    );
  }

  return (
    <section
      aria-labelledby="comunidad-heading"
      className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:px-6 md:px-8 md:py-10 md:pb-20"
    >
      {/* Cabecera + filtro horizontal */}
      <div className="border-b border-[var(--border-subtle)] pb-5 transition-colors duration-300">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1
                id="comunidad-heading"
                className="font-display text-3xl font-bold tracking-tight text-[var(--text-main)] sm:text-4xl"
              >
                Comunidad
              </h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Hilos rápidos, debates abiertos y conversaciones en vivo.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenAssistant}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3.5 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-fg)] transition-colors duration-300 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            >
              <Sparkles size={15} aria-hidden="true" />
              <span>Asistente IA</span>
            </button>
          </div>

          {/* Selector superior de Grupos / Sub-comunidades */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3.5 sm:p-4 transition-colors duration-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-main)]">
                <Compass
                  size={15}
                  className="text-[var(--accent-primary)]"
                  aria-hidden="true"
                />
                <span>Grupos y Comunidades</span>
                {communities.length > 0 && (
                  <span className="text-[11px] font-medium text-[var(--text-muted)] tabular-nums">
                    ({communities.length})
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) {
                    onOpenAuth();
                    return;
                  }
                  setIsCreateCommunityOpen(true);
                }}
                className="min-h-[34px] inline-flex items-center gap-1 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2.5 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-fg)] transition-colors"
              >
                <Plus size={13} aria-hidden="true" />
                <span>Crear grupo</span>
              </button>
            </div>

            <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => onSelectCommunityId(null)}
                aria-pressed={selectedCommunityId === null}
                className={`min-h-[42px] inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  selectedCommunityId === null
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                }`}
              >
                <span>🌐</span>
                <span>Todos los grupos</span>
              </button>

              {isLoadingCommunities && communities.length === 0 ? (
                <div className="flex items-center gap-2">
                  <div className="h-[42px] w-32 animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
                  <div className="h-[42px] w-36 animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
                </div>
              ) : (
                communities.map((comm) => {
                  const isSelected = selectedCommunityId === comm.id;
                  const isBusy = Boolean(busyCommunityIds[comm.id]);
                  return (
                    <div
                      key={comm.id}
                      className={`inline-flex shrink-0 items-center overflow-hidden rounded-xl border transition-colors ${
                        isSelected
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] hover:border-[var(--accent-border)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onSelectCommunityId(isSelected ? null : comm.id)
                        }
                        className="min-h-[40px] inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-[var(--text-main)] hover:text-[var(--accent-primary)] transition-colors whitespace-nowrap"
                      >
                        <span aria-hidden="true">{comm.icon}</span>
                        <span>{comm.name}</span>
                        <span className="text-[10px] font-medium text-[var(--text-muted)] tabular-nums">
                          {comm.members_count}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleToggleCommunityMembership(comm)
                        }
                        title={
                          comm.is_member
                            ? `Salir de ${comm.name}`
                            : `Unirse a ${comm.name}`
                        }
                        className={`min-h-[40px] border-l border-[var(--border-subtle)] px-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                          comm.is_member
                            ? 'text-emerald-600 dark:text-emerald-300 hover:text-red-500'
                            : 'text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-fg)]'
                        }`}
                      >
                        {comm.is_member ? (
                          <span className="inline-flex items-center gap-1">
                            <Check size={11} aria-hidden="true" />
                            <span>Unido</span>
                          </span>
                        ) : (
                          'Unirse'
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {activeCommunity && (
              <div className="mt-3 flex flex-col gap-2 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)]/50 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base" aria-hidden="true">
                      {activeCommunity.icon}
                    </span>
                    <p className="truncate font-display text-sm font-bold text-[var(--text-main)]">
                      {activeCommunity.name}
                    </p>
                    <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                      · {activeCommunity.members_count}{' '}
                      {activeCommunity.members_count === 1
                        ? 'miembro'
                        : 'miembros'}
                    </span>
                  </div>
                  {activeCommunity.description && (
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      {activeCommunity.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={Boolean(busyCommunityIds[activeCommunity.id])}
                    onClick={() =>
                      void handleToggleCommunityMembership(activeCommunity)
                    }
                    className={`min-h-[34px] rounded-lg border px-3 text-xs font-semibold transition-colors ${
                      activeCommunity.is_member
                        ? 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-red-500/40 hover:text-red-500'
                        : 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]'
                    }`}
                  >
                    {activeCommunity.is_member ? 'Salir del grupo' : 'Unirme'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectCommunityId(null)}
                    aria-label="Quitar filtro de comunidad"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              role="tablist"
              aria-label="Filtrar hilos por categoría"
              className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0"
            >
              {FILTER_OPTIONS.map((category) => {
                const isActive = selectedCategory === category;
                const isFollowingTab = category === 'Siguiendo';
                return (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onSelectCategory(category)}
                    className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors duration-300 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                      isActive
                        ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)] font-semibold'
                        : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {isFollowingTab && (
                      <UserCheck size={14} aria-hidden="true" />
                    )}
                    <span>{category}</span>
                  </button>
                );
              })}
            </div>

            <div
              role="group"
              aria-label="Ordenar hilos"
              className="inline-flex self-start sm:self-auto shrink-0 items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1 transition-colors duration-300"
            >
              <button
                type="button"
                onClick={() => setSortMode('recent')}
                aria-pressed={sortMode === 'recent'}
                className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  sortMode === 'recent'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                <Clock size={13} aria-hidden="true" />
                <span>Recientes</span>
              </button>
              <button
                type="button"
                onClick={() => setSortMode('popular')}
                aria-pressed={sortMode === 'popular'}
                className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  sortMode === 'popular'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                <Flame size={13} aria-hidden="true" />
                <span>Populares</span>
              </button>
            </div>
          </div>

          {/* Barra de hashtags populares + hashtag activo */}
          {(popularHashtags.length > 0 || selectedHashtag) && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)]">
                <Hash size={12} aria-hidden="true" />
                <span>Tendencias:</span>
              </span>

              {selectedHashtag &&
                !popularHashtags.some(
                  (tag) => tag.key === normalizeHashtag(selectedHashtag)
                ) && (
                  <button
                    type="button"
                    onClick={() => onSelectHashtag(null)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-primary)] transition-colors"
                  >
                    <span>{formatHashtagDisplay(selectedHashtag)}</span>
                    <X size={12} aria-hidden="true" />
                  </button>
                )}

              {popularHashtags.map((tag) => {
                const isSelected =
                  selectedHashtag !== null &&
                  normalizeHashtag(selectedHashtag) === tag.key;
                return (
                  <button
                    key={tag.key}
                    type="button"
                    onClick={() => handleSelectHashtagChip(tag.display)}
                    aria-pressed={isSelected}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                      isSelected
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-fg)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--accent-primary)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]'
                    }`}
                  >
                    <span>{tag.display}</span>
                    <span
                      className={`text-[10px] tabular-nums ${
                        isSelected ? 'opacity-90' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {tag.count}
                    </span>
                  </button>
                );
              })}

              {selectedHashtag && (
                <button
                  type="button"
                  onClick={() => onSelectHashtag(null)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors"
                >
                  <X size={12} aria-hidden="true" />
                  <span>Limpiar filtro</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mt-5 flex items-start justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/12 px-4 py-3 text-sm text-red-700 dark:text-red-100"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0 text-red-500 dark:text-red-400"
              aria-hidden="true"
            />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Cerrar aviso"
            className="shrink-0 rounded-lg p-1 text-red-600 dark:text-red-200 hover:bg-red-500/15"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Feed dinámico de hilos */}
      {isLoading ? (
        <div className="mt-6 space-y-4 animate-pulse">
          {[1, 2, 3].map((row) => (
            <div
              key={row}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[var(--bg-elevated)]" />
                <div className="h-4 w-44 rounded bg-[var(--bg-elevated)]" />
              </div>
              <div className="mt-4 h-4 w-full rounded bg-[var(--bg-subtle)]" />
              <div className="mt-2 h-4 w-3/4 rounded bg-[var(--bg-subtle)]" />
            </div>
          ))}
        </div>
      ) : errorMsg ? (
        <div
          role="alert"
          className="mt-8 flex flex-col gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-700 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle
              size={18}
              className="shrink-0 text-red-500 dark:text-red-400"
              aria-hidden="true"
            />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadThreads()}
            className="min-h-[40px] self-start sm:self-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="mx-auto mt-14 flex max-w-md flex-col items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-14 text-center transition-colors duration-300">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <Users size={22} aria-hidden="true" />
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold text-[var(--text-main)]">
            {activeCommunity
              ? `Aún no hay hilos en ${activeCommunity.icon} ${activeCommunity.name}`
              : selectedHashtag
                ? `Sin hilos con ${formatHashtagDisplay(selectedHashtag)}`
                : selectedCategory === 'Siguiendo'
                  ? !isAuthenticated
                    ? 'Inicia sesión para ver tu feed de Siguiendo'
                    : 'Aún no hay hilos de personas que sigues'
                  : selectedCategory === 'Todos'
                    ? 'Todavía no hay hilos en la comunidad'
                    : `No hay hilos en ${selectedCategory}`}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            {activeCommunity
              ? 'Sé el primero en abrir una conversación dentro de este grupo o explora otros grupos arriba.'
              : selectedHashtag
                ? 'Prueba con otra etiqueta o limpia el filtro para ver toda la conversación.'
                : selectedCategory === 'Siguiendo'
                  ? 'Sigue a autores y lectores desde sus publicaciones o perfiles para ver sus hilos aquí.'
                  : selectedCategory === 'Todos'
                    ? 'Lanza una pregunta, recomendación o debate con hashtags como #Anime o #Gaming.'
                    : 'Explora otra categoría o inicia el primer hilo aquí.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {(selectedCategory !== 'Todos' ||
              selectedHashtag ||
              selectedCommunityId) && (
              <button
                type="button"
                onClick={() => {
                  onSelectCategory('Todos');
                  onSelectHashtag(null);
                  onSelectCommunityId(null);
                }}
                className="min-h-[44px] rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                Ver todos los hilos
              </button>
            )}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onOpenCreate}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] transition-colors"
              >
                <PenSquare size={16} aria-hidden="true" />
                <span>Crear hilo</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="min-h-[44px] rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] transition-colors"
              >
                Iniciar sesión para publicar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {filteredPosts.map((thread) => {
            const canModerate = Boolean(
              isOwner || (user && user.id === thread.author_id)
            );
            const authorName = getAuthorDisplayName(thread.author);
            const readMinutes = estimateReadMinutes(thread.content);

            return (
              <article
                key={thread.id}
                className={`overflow-hidden rounded-2xl border bg-[var(--bg-card)] shadow-sm transition-colors duration-300 ${
                  thread.is_pinned
                    ? 'border-amber-500/45 dark:border-amber-400/40'
                    : 'border-[var(--border-subtle)] hover:border-[var(--accent-border)]'
                }`}
              >
                {/* ZONA 1: CABECERA */}
                <div className="px-4 pt-4 sm:px-5 sm:pt-5">
                  {thread.is_pinned && (
                    <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-300">
                      <Pin size={12} aria-hidden="true" />
                      <span>Hilo fijado por el Dueño</span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onOpenAuthorProfile(thread.author_id)}
                        aria-label={`Ver perfil de ${authorName}`}
                        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                      >
                        <Avatar
                          src={thread.author?.avatar_url}
                          name={thread.author?.username}
                          size="md"
                        />
                      </button>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenAuthorProfile(thread.author_id)}
                            className="truncate text-sm font-semibold text-[var(--text-main)] hover:text-[var(--accent-primary)] transition-colors max-w-[170px]"
                          >
                            {authorName}
                          </button>
                          <OwnerBadge
                            role={thread.author?.role}
                            badge={thread.author?.badge}
                            size="xs"
                          />
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--text-muted)]">
                          <span className="font-semibold text-[var(--accent-primary)]">
                            {thread.category}
                          </span>
                          {thread.community_id &&
                            communitiesById.get(thread.community_id) && (
                              <>
                                <span aria-hidden="true">·</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSelectCommunityId(thread.community_id)
                                  }
                                  className="inline-flex items-center gap-1 font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
                                >
                                  <span aria-hidden="true">
                                    {communitiesById.get(thread.community_id)?.icon}
                                  </span>
                                  <span>
                                    {communitiesById.get(thread.community_id)?.name}
                                  </span>
                                </button>
                              </>
                            )}
                          <span aria-hidden="true">·</span>
                          <time
                            dateTime={thread.created_at}
                            className="tabular-nums"
                          >
                            {formatRelativeDate(thread.created_at)}
                          </time>
                          {thread.content.length > 260 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Clock size={11} aria-hidden="true" />
                                {readMinutes} min
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <FollowButton
                      targetUserId={thread.author_id}
                      onOpenAuth={onOpenAuth}
                      size="xs"
                    />
                  </div>
                </div>

                {/* ZONA 2: CUERPO (sin botones anidados para que los hashtags sean clicables) */}
                <div className="px-4 pt-3.5 pb-4 sm:px-5">
                  {thread.title && (
                    <button
                      type="button"
                      onClick={() => onSelectPost(thread)}
                      className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded-lg"
                    >
                      <h2 className="font-display text-lg font-bold leading-snug text-[var(--text-main)] hover:text-[var(--accent-primary)] transition-colors duration-300 sm:text-xl">
                        {thread.title}
                      </h2>
                    </button>
                  )}

                  <div
                    onClick={() => onSelectPost(thread)}
                    className={`${
                      thread.title ? 'mt-2' : ''
                    } cursor-pointer reading-prose-compact text-[var(--text-secondary)] whitespace-pre-line break-words`}
                  >
                    <HashtagText
                      text={thread.content}
                      onSelectHashtag={handleSelectHashtagChip}
                    />
                  </div>

                  {thread.image_url && (
                    <button
                      type="button"
                      onClick={() => onSelectPost(thread)}
                      className="mt-3.5 block w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                    >
                      <MediaImage
                        src={thread.image_url}
                        alt={thread.title || 'Imagen adjunta al hilo'}
                        className="max-h-96 w-full object-cover"
                        fallbackClassName="h-48 w-full"
                      />
                    </button>
                  )}

                  {pollsByPostId[thread.id] && (
                    <PollCard
                      poll={pollsByPostId[thread.id]}
                      onOpenAuth={onOpenAuth}
                      onPollUpdated={(updatedPoll) =>
                        setPollsByPostId((prev) => ({
                          ...prev,
                          [thread.id]: updatedPoll,
                        }))
                      }
                    />
                  )}
                </div>

                {/* ZONA 3: PIE (Reacciones, Comentarios y Moderación) */}
                <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]/55 px-4 py-2 sm:px-5 transition-colors duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 -ml-1.5">
                      <button
                        type="button"
                        onClick={() => void handleToggleLike(thread)}
                        disabled={Boolean(likingIds[thread.id])}
                        aria-pressed={thread.liked_by_me}
                        aria-label={
                          thread.liked_by_me
                            ? 'Quitar Me gusta'
                            : 'Dar Me gusta'
                        }
                        className={`min-h-[42px] inline-flex items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                          thread.liked_by_me
                            ? 'bg-rose-500/12 text-rose-600 dark:text-rose-300'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        <Heart
                          size={16}
                          className={
                            thread.liked_by_me
                              ? 'fill-rose-500 text-rose-500 dark:fill-rose-400 dark:text-rose-400'
                              : ''
                          }
                          aria-hidden="true"
                        />
                        <span className="tabular-nums">
                          {thread.likes_count}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectPost(thread)}
                        aria-label="Ver y responder comentarios"
                        className="min-h-[42px] inline-flex items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                      >
                        <MessageSquare size={16} aria-hidden="true" />
                        <span className="tabular-nums">
                          {thread.comments_count}
                        </span>
                        <span className="hidden sm:inline">Comentarios</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleToggleSave(thread.id)}
                        disabled={Boolean(busySavePostIds[thread.id])}
                        aria-pressed={isPostSaved(thread.id)}
                        aria-label={
                          isPostSaved(thread.id)
                            ? 'Quitar de guardados'
                            : 'Guardar hilo'
                        }
                        className={`min-h-[42px] inline-flex items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                          isPostSaved(thread.id)
                            ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        <Bookmark
                          size={15}
                          className={
                            isPostSaved(thread.id) ? 'fill-current' : ''
                          }
                          aria-hidden="true"
                        />
                        <span>
                          {isPostSaved(thread.id) ? 'Guardado' : 'Guardar'}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-0.5">
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => void handleTogglePin(thread)}
                          disabled={Boolean(pinningIds[thread.id])}
                          title={
                            thread.is_pinned
                              ? 'Quitar fijado'
                              : 'Fijar arriba de Comunidad'
                          }
                          aria-label={
                            thread.is_pinned ? 'Quitar fijado' : 'Fijar hilo'
                          }
                          className={`min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                            thread.is_pinned
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 hover:bg-amber-500/25'
                              : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-amber-600 dark:hover:text-amber-300'
                          }`}
                        >
                          {thread.is_pinned ? (
                            <PinOff size={16} aria-hidden="true" />
                          ) : (
                            <Pin size={16} aria-hidden="true" />
                          )}
                        </button>
                      )}

                      {canModerate && (
                        <button
                          type="button"
                          onClick={() => setEditingPost(thread)}
                          title="Editar hilo"
                          aria-label="Editar hilo"
                          className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                      )}

                      {canModerate && confirmDeleteId !== thread.id && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(thread.id)}
                          title="Eliminar hilo"
                          aria-label="Eliminar hilo"
                          className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-red-500/12 hover:text-red-600 dark:hover:text-red-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      )}

                      {user?.id !== thread.author_id && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!isAuthenticated || !user) {
                              onOpenAuth();
                              return;
                            }
                            setReportingPost(thread);
                          }}
                          disabled={reportedPostIds.has(thread.id)}
                          title={
                            reportedPostIds.has(thread.id)
                              ? 'Ya reportaste esta publicación'
                              : 'Reportar publicación'
                          }
                          aria-label="Reportar hilo"
                          className={`min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                            reportedPostIds.has(thread.id)
                              ? 'text-rose-400/70 cursor-default'
                              : 'text-[var(--text-muted)] hover:bg-rose-500/10 hover:text-rose-400'
                          }`}
                        >
                          <Flag size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  {confirmDeleteId === thread.id && (
                    <div className="mt-2 flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] pt-2.5 pb-1 text-xs">
                      <span className="text-[var(--text-secondary)]">
                        ¿Eliminar este hilo?
                      </span>
                      <button
                        type="button"
                        disabled={deletingId === thread.id}
                        onClick={() => void handleConfirmDelete(thread.id)}
                        className="min-h-[36px] rounded-lg bg-red-600 px-3 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        {deletingId === thread.id
                          ? 'Eliminando…'
                          : 'Confirmar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[36px] rounded-lg px-2.5 text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <EditPostModal
        post={editingPost}
        onClose={() => setEditingPost(null)}
        onSaved={handleEditedSaved}
      />

      <ReportPostModal
        isOpen={Boolean(reportingPost)}
        postId={reportingPost?.id ?? null}
        postTitle={reportingPost?.title || reportingPost?.content.slice(0, 80)}
        reporterId={user?.id ?? null}
        onClose={() => setReportingPost(null)}
        onSubmitted={(postId) =>
          setReportedPostIds((prev) => new Set(prev).add(postId))
        }
      />

      <CreateCommunityModal
        isOpen={isCreateCommunityOpen}
        onClose={() => setIsCreateCommunityOpen(false)}
        onCreated={(created) => {
          setCommunities((prev) => [created, ...prev]);
          onSelectCommunityId(created.id);
        }}
      />
    </section>
  );
}
