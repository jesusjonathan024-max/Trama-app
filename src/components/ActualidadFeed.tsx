import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Bookmark,
  Clock,
  ExternalLink,
  Eye,
  Flag,
  Flame,
  Heart,
  MessageSquare,
  Newspaper,
  PenSquare,
  Pencil,
  Pin,
  PinOff,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocial } from '../context/SocialContext';
import { ENABLE_AI_FEATURES } from '../lib/ai';
import { fetchUserReportedPostIds } from '../lib/phase2';
import {
  THEMATIC_CATEGORIES,
  deletePost,
  estimateReadMinutes,
  fetchPostsByMode,
  formatEditorialDate,
  getAuthorDisplayName,
  matchesThematicCategory,
  sortPostsWithPinnedFirst,
  togglePostLike,
  togglePostPin,
  togglePostVerified,
  type PostRecord,
} from '../lib/posts';
import { sortPostsByMode, type FeedSortMode } from '../lib/social';
import { getCategoryVisualTheme } from '../lib/categoryColors';
import { Avatar } from './Avatar';
import { CategoryCoverArtwork } from './CategoryCoverArtwork';
import { EditPostModal } from './EditPostModal';
import { FollowButton } from './FollowButton';
import { MediaImage } from './MediaImage';
import { OwnerBadge } from './OwnerBadge';
import { ReportPostModal } from './ReportPostModal';
import { ThematicCategoryIcon } from './ThematicCategoryIcon';
import { VerifiedBadge } from './VerifiedBadge';

interface ActualidadFeedProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  refreshKey: number;
  syncedPostUpdate: PostRecord | null;
  deletedPostId: string | null;
  onSelectPost: (post: PostRecord) => void;
  onOpenAuthorProfile: (authorId: string) => void;
  onOpenAuth: () => void;
  onOpenCreate: () => void;
  onOpenAssistant: () => void;
}

const FILTER_OPTIONS = ['Todo', ...THEMATIC_CATEGORIES] as const;

export function ActualidadFeed({
  selectedCategory,
  onSelectCategory,
  refreshKey,
  syncedPostUpdate,
  deletedPostId,
  onSelectPost,
  onOpenAuthorProfile,
  onOpenAuth,
  onOpenCreate,
  onOpenAssistant,
}: ActualidadFeedProps) {
  const { user, isAuthenticated, isOwner, canVerifyNews } = useAuth();
  const { isPostSaved, busySavePostIds, toggleSavePost } = useSocial();
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [sortMode, setSortMode] = useState<FeedSortMode>('recent');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [likingIds, setLikingIds] = useState<Record<string, boolean>>({});
  const [pinningIds, setPinningIds] = useState<Record<string, boolean>>({});
  const [verifyingIds, setVerifyingIds] = useState<Record<string, boolean>>({});
  const [reportedPostIds, setReportedPostIds] = useState<Set<string>>(
    () => new Set()
  );
  const [reportingPost, setReportingPost] = useState<PostRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<PostRecord | null>(null);

  const loadArticles = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchPostsByMode('actualidad', user?.id);
      setPosts(data);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los artículos de Actualidad.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadArticles();
  }, [loadArticles, refreshKey]);

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
    if (!syncedPostUpdate || syncedPostUpdate.mode !== 'actualidad') return;
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

  const filteredPosts = useMemo(() => {
    const base = posts.filter((post) =>
      matchesThematicCategory(post.category, selectedCategory)
    );
    return sortPostsByMode(base, sortMode);
  }, [posts, selectedCategory, sortMode]);

  async function handleToggleSave(postId: string) {
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }
    await toggleSavePost(postId);
  }

  const leadArticle = filteredPosts[0] ?? null;
  const editorialList = filteredPosts.slice(1);

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

  async function handleToggleVerified(post: PostRecord) {
    if (!canVerifyNews || verifyingIds[post.id]) return;
    setActionError(null);
    const nextVerified = !post.is_verified;

    setVerifyingIds((prev) => ({ ...prev, [post.id]: true }));
    setPosts((prev) =>
      prev.map((item) =>
        item.id === post.id ? { ...item, is_verified: nextVerified } : item
      )
    );

    try {
      await togglePostVerified(post.id, nextVerified);
    } catch (err) {
      setPosts((prev) =>
        prev.map((item) =>
          item.id === post.id
            ? { ...item, is_verified: post.is_verified }
            : item
        )
      );
      setActionError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la verificación de la noticia.'
      );
    } finally {
      setVerifyingIds((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  function handleOpenReport(post: PostRecord) {
    if (!isAuthenticated || !user) {
      onOpenAuth();
      return;
    }
    setReportingPost(post);
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
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el artículo.'
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
      aria-labelledby="actualidad-heading"
      className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 md:px-8 md:py-10 md:pb-20"
    >
      {/* Cabecera editorial + filtro horizontal de categorías */}
      <div className="border-b border-[var(--border-subtle)] pb-5 transition-colors duration-300">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-wrap items-start justify-between gap-3 md:flex-col md:items-start">
            <div>
              <h1
                id="actualidad-heading"
                className="font-display text-3xl font-bold tracking-tight text-[var(--text-main)] sm:text-4xl"
              >
                Actualidad
              </h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Artículos largos, crónicas y análisis de fondo.
              </p>
            </div>

            {ENABLE_AI_FEATURES && (
              <button
                type="button"
                onClick={onOpenAssistant}
                className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3.5 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-fg)] transition-colors duration-300 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              >
                <Sparkles size={15} aria-hidden="true" />
                <span>Asistente IA</span>
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <div
              role="tablist"
              aria-label="Filtrar artículos por sección temática"
              className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0"
            >
              {FILTER_OPTIONS.map((category) => {
                const isAll = category === 'Todo';
                const isActive =
                  selectedCategory === category ||
                  (isAll && selectedCategory === 'Todas');
                const theme = getCategoryVisualTheme(category, 'actualidad');
                return (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onSelectCategory(category)}
                    className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                      isAll
                        ? isActive
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-fg)] shadow-sm'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                        : isActive
                          ? theme.filterActiveClass
                          : theme.filterIdleClass
                    }`}
                  >
                    <ThematicCategoryIcon category={category} size={14} />
                    <span>{category}</span>
                  </button>
                );
              })}
            </div>

            <div
              role="group"
              aria-label="Ordenar artículos"
              className="inline-flex self-start md:self-auto items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1 transition-colors duration-300"
            >
              <button
                type="button"
                onClick={() => setSortMode('recent')}
                aria-pressed={sortMode === 'recent'}
                className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                  sortMode === 'recent'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                <Clock size={13} aria-hidden="true" />
                <span>Más recientes</span>
              </button>
              <button
                type="button"
                onClick={() => setSortMode('popular')}
                aria-pressed={sortMode === 'popular'}
                className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                  sortMode === 'popular'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                <Flame size={13} aria-hidden="true" />
                <span>Más populares</span>
              </button>
            </div>
          </div>
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

      {/* Contenido principal */}
      {isLoading ? (
        <div className="mt-8 space-y-8 animate-pulse">
          <div className="grid grid-cols-1 gap-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 lg:grid-cols-12">
            <div className="h-64 rounded-xl bg-[var(--bg-elevated)] lg:col-span-7 lg:h-80" />
            <div className="space-y-4 lg:col-span-5">
              <div className="h-4 w-32 rounded bg-[var(--bg-elevated)]" />
              <div className="h-9 w-full rounded bg-[var(--bg-elevated)]" />
              <div className="h-20 w-full rounded bg-[var(--bg-subtle)]" />
              <div className="h-6 w-48 rounded bg-[var(--bg-elevated)]" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {[1, 2].map((row) => (
              <div
                key={row}
                className="h-52 w-full rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)]"
              />
            ))}
          </div>
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
            onClick={() => void loadArticles()}
            className="min-h-[40px] self-start sm:self-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : !leadArticle ? (
        <div className="mx-auto mt-14 flex max-w-md flex-col items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-14 text-center transition-colors duration-300">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <Newspaper size={22} aria-hidden="true" />
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold text-[var(--text-main)]">
            {selectedCategory === 'Todo' || selectedCategory === 'Todas'
              ? 'Todavía no hay artículos publicados'
              : `No hay artículos en ${selectedCategory}`}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            {selectedCategory === 'Todo' || selectedCategory === 'Todas'
              ? 'Publica la primera crónica o análisis editorial para inaugurar la portada.'
              : 'Prueba otra sección temática o publica el primer artículo sobre este tema.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {selectedCategory !== 'Todo' && selectedCategory !== 'Todas' && (
              <button
                type="button"
                onClick={() => onSelectCategory('Todo')}
                className="min-h-[44px] rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                Ver todas las secciones
              </button>
            )}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onOpenCreate}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] transition-colors"
              >
                <PenSquare size={16} aria-hidden="true" />
                <span>Escribir artículo</span>
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
        <div className="mt-8 space-y-8">
          {/* Portada destacada superior (3 zonas: Cabecera, Cuerpo, Pie) */}
          <article
            className={`trama-card-glow group grid grid-cols-1 lg:grid-cols-12 items-stretch overflow-hidden rounded-2xl border bg-[var(--bg-card)] shadow-sm ${
              leadArticle.is_pinned
                ? 'border-amber-500/50 dark:border-amber-400/45'
                : 'border-[var(--border-subtle)]'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectPost(leadArticle)}
              className="block w-full overflow-hidden bg-[var(--bg-subtle)] text-left lg:col-span-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary)]"
            >
              {leadArticle.image_url ? (
                <MediaImage
                  src={leadArticle.image_url}
                  alt={leadArticle.title || 'Portada del artículo destacado'}
                  className="h-60 w-full object-cover transition-transform duration-300 group-hover:scale-[1.015] sm:h-80 lg:h-full lg:min-h-[380px]"
                  fallbackClassName="h-60 w-full sm:h-80 lg:h-full lg:min-h-[380px]"
                />
              ) : (
                <CategoryCoverArtwork
                  category={leadArticle.category}
                  title={leadArticle.title}
                  fallbackMode="actualidad"
                  variant="hero"
                  className="h-60 w-full transition-transform duration-300 group-hover:scale-[1.015] sm:h-80 lg:h-full lg:min-h-[380px]"
                />
              )}
            </button>

            <div className="flex flex-col justify-between p-5 sm:p-7 lg:col-span-5">
              {/* ZONA 1: CABECERA (Avatar, Autor, Insignia, Categoría y Fecha) */}
              <div>
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenAuthorProfile(leadArticle.author_id)}
                      aria-label={`Ver perfil de ${getAuthorDisplayName(leadArticle.author)}`}
                      className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                    >
                      <Avatar
                        src={leadArticle.author?.avatar_url}
                        name={leadArticle.author?.username}
                        size="sm"
                      />
                    </button>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenAuthorProfile(leadArticle.author_id)}
                          className="truncate text-xs font-semibold text-[var(--text-main)] hover:text-[var(--accent-primary)] transition-colors max-w-[140px]"
                        >
                          {getAuthorDisplayName(leadArticle.author)}
                        </button>
                        <OwnerBadge
                          role={leadArticle.author?.role}
                          badge={leadArticle.author?.badge}
                          size="xs"
                        />
                        <FollowButton
                          targetUserId={leadArticle.author_id}
                          onOpenAuth={onOpenAuth}
                          size="xs"
                        />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-[var(--text-muted)]">
                        <span
                          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${getCategoryVisualTheme(leadArticle.category, 'actualidad').labelClass}`}
                        >
                          {leadArticle.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <time
                          dateTime={leadArticle.created_at}
                          className="tabular-nums"
                        >
                          {formatEditorialDate(leadArticle.created_at)}
                        </time>
                        {leadArticle.is_verified && <VerifiedBadge compact />}
                      </div>
                    </div>
                  </div>

                  {leadArticle.is_pinned && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                      <Pin size={12} aria-hidden="true" />
                      <span>Fijado</span>
                    </span>
                  )}
                </div>

                {/* ZONA 2: CUERPO (Título nítido, Extracto escalable, Tiempo de lectura y Fuente) */}
                <button
                  type="button"
                  onClick={() => onSelectPost(leadArticle)}
                  className="mt-4 block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded-lg"
                >
                  <h2 className="text-balance font-display text-2xl font-bold leading-snug tracking-tight text-[var(--text-main)] group-hover:text-[var(--accent-primary)] transition-colors duration-300 sm:text-3xl">
                    {leadArticle.title || 'Artículo sin título'}
                  </h2>
                  <p className="mt-3 line-clamp-3 reading-prose-compact text-[var(--text-secondary)]">
                    {leadArticle.content}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[var(--text-muted)] tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={13} aria-hidden="true" />
                      <span>
                        {estimateReadMinutes(leadArticle.content)} min de lectura
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Eye size={13} aria-hidden="true" />
                      <span>{leadArticle.views_count}</span>
                    </span>
                  </div>
                </button>

                {(leadArticle.source_name || leadArticle.source_url) && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <span className="font-medium">Fuente:</span>
                    {leadArticle.source_url ? (
                      <a
                        href={leadArticle.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[var(--accent-primary)] hover:underline truncate max-w-[240px]"
                      >
                        <span className="truncate">
                          {leadArticle.source_name ||
                            new URL(leadArticle.source_url).hostname.replace(
                              /^www\./,
                              ''
                            )}
                        </span>
                        <ExternalLink size={12} className="shrink-0" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="font-semibold text-[var(--text-secondary)] truncate">
                        {leadArticle.source_name}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* ZONA 3: PIE (Reacciones, Comentarios y Moderación) */}
              <div className="mt-5 border-t border-[var(--border-subtle)] pt-3.5 transition-colors duration-300">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 -ml-1.5">
                    <button
                      type="button"
                      onClick={() => void handleToggleLike(leadArticle)}
                      disabled={Boolean(likingIds[leadArticle.id])}
                      aria-pressed={leadArticle.liked_by_me}
                      aria-label="Dar Me gusta al artículo"
                      className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                        leadArticle.liked_by_me
                          ? 'bg-rose-500/12 text-rose-600 dark:text-rose-300'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      <Heart
                        size={15}
                        className={
                          leadArticle.liked_by_me
                            ? 'fill-rose-500 text-rose-500 dark:fill-rose-400 dark:text-rose-400'
                            : ''
                        }
                        aria-hidden="true"
                      />
                      <span className="tabular-nums">{leadArticle.likes_count}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectPost(leadArticle)}
                      aria-label="Abrir comentarios del artículo"
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-sky-500/12 hover:text-sky-600 dark:hover:text-sky-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                    >
                      <MessageSquare size={15} aria-hidden="true" />
                      <span className="tabular-nums">
                        {leadArticle.comments_count}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleToggleSave(leadArticle.id)}
                      disabled={Boolean(busySavePostIds[leadArticle.id])}
                      aria-pressed={isPostSaved(leadArticle.id)}
                      aria-label={
                        isPostSaved(leadArticle.id)
                          ? 'Quitar de guardados'
                          : 'Guardar artículo'
                      }
                      className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                        isPostSaved(leadArticle.id)
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'text-[var(--text-secondary)] hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300'
                      }`}
                    >
                      <Bookmark
                        size={15}
                        className={
                          isPostSaved(leadArticle.id) ? 'fill-current' : ''
                        }
                        aria-hidden="true"
                      />
                      <span>
                        {isPostSaved(leadArticle.id) ? 'Guardado' : 'Guardar'}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-0.5">
                    {canVerifyNews && (
                      <button
                        type="button"
                        onClick={() => void handleToggleVerified(leadArticle)}
                        disabled={Boolean(verifyingIds[leadArticle.id])}
                        title={
                          leadArticle.is_verified
                            ? 'Quitar sello de Noticia Verificada'
                            : 'Marcar como Noticia Verificada'
                        }
                        aria-label={
                          leadArticle.is_verified
                            ? 'Quitar verificación'
                            : 'Verificar noticia'
                        }
                        className={`min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                          leadArticle.is_verified
                            ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-emerald-500'
                        }`}
                      >
                        <BadgeCheck size={16} aria-hidden="true" />
                      </button>
                    )}

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => void handleTogglePin(leadArticle)}
                        disabled={Boolean(pinningIds[leadArticle.id])}
                        title={
                          leadArticle.is_pinned
                            ? 'Quitar fijado'
                            : 'Fijar arriba de Actualidad'
                        }
                        aria-label={
                          leadArticle.is_pinned
                            ? 'Quitar fijado'
                            : 'Fijar artículo'
                        }
                        className={`min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                          leadArticle.is_pinned
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 hover:bg-amber-500/25'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-amber-600 dark:hover:text-amber-300'
                        }`}
                      >
                        {leadArticle.is_pinned ? (
                          <PinOff size={15} aria-hidden="true" />
                        ) : (
                          <Pin size={15} aria-hidden="true" />
                        )}
                      </button>
                    )}

                    {(isOwner || user?.id === leadArticle.author_id) && (
                      <button
                        type="button"
                        onClick={() => setEditingPost(leadArticle)}
                        title="Editar artículo"
                        aria-label="Editar artículo"
                        className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                    )}

                    {(isOwner || user?.id === leadArticle.author_id) &&
                      confirmDeleteId !== leadArticle.id && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(leadArticle.id)}
                          title="Eliminar artículo"
                          aria-label="Eliminar artículo"
                          className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-red-500/12 hover:text-red-600 dark:hover:text-red-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      )}

                    {user?.id !== leadArticle.author_id && (
                      <button
                        type="button"
                        onClick={() => handleOpenReport(leadArticle)}
                        disabled={reportedPostIds.has(leadArticle.id)}
                        title={
                          reportedPostIds.has(leadArticle.id)
                            ? 'Ya reportaste esta publicación'
                            : 'Reportar noticia falsa o inapropiada'
                        }
                        aria-label="Reportar artículo"
                        className={`min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                          reportedPostIds.has(leadArticle.id)
                            ? 'text-rose-400/70 cursor-default'
                            : 'text-[var(--text-muted)] hover:bg-rose-500/10 hover:text-rose-400'
                        }`}
                      >
                        <Flag size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {confirmDeleteId === leadArticle.id && (
                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] pt-3 text-xs">
                    <span className="text-[var(--text-secondary)]">
                      ¿Eliminar este artículo?
                    </span>
                    <button
                      type="button"
                      disabled={deletingId === leadArticle.id}
                      onClick={() => void handleConfirmDelete(leadArticle.id)}
                      className="min-h-[34px] rounded-lg bg-red-600 px-3 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      {deletingId === leadArticle.id
                        ? 'Eliminando…'
                        : 'Confirmar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="min-h-[34px] rounded-lg px-2.5 text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </article>

          {/* Tarjetas editoriales estructuradas debajo de la portada */}
          {editorialList.length > 0 && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {editorialList.map((article) => {
                const canModerate = Boolean(
                  isOwner || (user && user.id === article.author_id)
                );
                return (
                  <article
                    key={article.id}
                    className={`trama-card-glow group flex flex-col justify-between overflow-hidden rounded-2xl border bg-[var(--bg-card)] shadow-sm ${
                      article.is_pinned
                        ? 'border-amber-500/50 dark:border-amber-400/45'
                        : 'border-[var(--border-subtle)]'
                    }`}
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => onSelectPost(article)}
                        className="block w-full overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary)]"
                      >
                        {article.image_url ? (
                          <MediaImage
                            src={article.image_url}
                            alt={article.title || 'Imagen del artículo'}
                            className="aspect-[16/9] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                            fallbackClassName="aspect-[16/9] w-full"
                          />
                        ) : (
                          <CategoryCoverArtwork
                            category={article.category}
                            title={article.title}
                            fallbackMode="actualidad"
                            variant="card"
                            className="aspect-[16/9] w-full transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        )}
                      </button>

                      <div className="p-5">
                        {/* ZONA 1: CABECERA */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => onOpenAuthorProfile(article.author_id)}
                              aria-label={`Ver perfil de ${getAuthorDisplayName(article.author)}`}
                              className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                            >
                              <Avatar
                                src={article.author?.avatar_url}
                                name={article.author?.username}
                                size="sm"
                              />
                            </button>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onOpenAuthorProfile(article.author_id)}
                                  className="truncate text-xs font-semibold text-[var(--text-main)] hover:text-[var(--accent-primary)] transition-colors max-w-[140px]"
                                >
                                  {getAuthorDisplayName(article.author)}
                                </button>
                                <OwnerBadge
                                  role={article.author?.role}
                                  badge={article.author?.badge}
                                  size="xs"
                                />
                                <FollowButton
                                  targetUserId={article.author_id}
                                  onOpenAuth={onOpenAuth}
                                  size="xs"
                                />
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-[var(--text-muted)]">
                                <span
                                  className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${getCategoryVisualTheme(article.category, 'actualidad').labelClass}`}
                                >
                                  {article.category}
                                </span>
                                <span aria-hidden="true">·</span>
                                <time
                                  dateTime={article.created_at}
                                  className="tabular-nums"
                                >
                                  {formatEditorialDate(article.created_at)}
                                </time>
                                {article.is_verified && <VerifiedBadge compact />}
                              </div>
                            </div>
                          </div>

                          {article.is_pinned && (
                            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                              <Pin size={12} aria-hidden="true" />
                              <span>Fijado</span>
                            </span>
                          )}
                        </div>

                        {/* ZONA 2: CUERPO */}
                        <button
                          type="button"
                          onClick={() => onSelectPost(article)}
                          className="mt-3.5 block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded-lg"
                        >
                          <h3 className="text-balance font-display text-xl font-bold leading-snug tracking-tight text-[var(--text-main)] group-hover:text-[var(--accent-primary)] transition-colors duration-300">
                            {article.title || 'Artículo sin título'}
                          </h3>
                          <p className="mt-2.5 line-clamp-3 reading-prose-compact text-[var(--text-secondary)]">
                            {article.content}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[var(--text-muted)] tabular-nums">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock size={13} aria-hidden="true" />
                              <span>
                                {estimateReadMinutes(article.content)} min de lectura
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Eye size={13} aria-hidden="true" />
                              <span>{article.views_count}</span>
                            </span>
                          </div>
                        </button>

                        {(article.source_name || article.source_url) && (
                          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                            <span className="font-medium">Fuente:</span>
                            {article.source_url ? (
                              <a
                                href={article.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-[var(--accent-primary)] hover:underline truncate max-w-[210px]"
                              >
                                <span className="truncate">
                                  {article.source_name ||
                                    new URL(article.source_url).hostname.replace(
                                      /^www\./,
                                      ''
                                    )}
                                </span>
                                <ExternalLink size={12} className="shrink-0" aria-hidden="true" />
                              </a>
                            ) : (
                              <span className="font-semibold text-[var(--text-secondary)] truncate">
                                {article.source_name}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ZONA 3: PIE */}
                    <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]/55 px-5 py-2.5 transition-colors duration-300">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1 -ml-1.5">
                          <button
                            type="button"
                            onClick={() => void handleToggleLike(article)}
                            disabled={Boolean(likingIds[article.id])}
                            aria-pressed={article.liked_by_me}
                            aria-label="Dar Me gusta al artículo"
                            className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                              article.liked_by_me
                                ? 'bg-rose-500/12 text-rose-600 dark:text-rose-300'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                            }`}
                          >
                            <Heart
                              size={15}
                              className={
                                article.liked_by_me
                                  ? 'fill-rose-500 text-rose-500 dark:fill-rose-400 dark:text-rose-400'
                                  : ''
                              }
                              aria-hidden="true"
                            />
                            <span className="tabular-nums">
                              {article.likes_count}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onSelectPost(article)}
                            aria-label="Abrir comentarios del artículo"
                            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-sky-500/12 hover:text-sky-600 dark:hover:text-sky-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                          >
                            <MessageSquare size={15} aria-hidden="true" />
                            <span className="tabular-nums">
                              {article.comments_count}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleToggleSave(article.id)}
                            disabled={Boolean(busySavePostIds[article.id])}
                            aria-pressed={isPostSaved(article.id)}
                            aria-label={
                              isPostSaved(article.id)
                                ? 'Quitar de guardados'
                                : 'Guardar artículo'
                            }
                            className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                              isPostSaved(article.id)
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                : 'text-[var(--text-secondary)] hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300'
                            }`}
                          >
                            <Bookmark
                              size={15}
                              className={
                                isPostSaved(article.id) ? 'fill-current' : ''
                              }
                              aria-hidden="true"
                            />
                            <span className="hidden sm:inline">
                              {isPostSaved(article.id) ? 'Guardado' : 'Guardar'}
                            </span>
                          </button>
                        </div>

                        <div className="flex items-center gap-0.5">
                          {canVerifyNews && (
                            <button
                              type="button"
                              onClick={() => void handleToggleVerified(article)}
                              disabled={Boolean(verifyingIds[article.id])}
                              title={
                                article.is_verified
                                  ? 'Quitar sello de Noticia Verificada'
                                  : 'Marcar como Noticia Verificada'
                              }
                              aria-label={
                                article.is_verified
                                  ? 'Quitar verificación'
                                  : 'Verificar noticia'
                              }
                              className={`min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                                article.is_verified
                                  ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25'
                                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-emerald-500'
                              }`}
                            >
                              <BadgeCheck size={16} aria-hidden="true" />
                            </button>
                          )}

                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => void handleTogglePin(article)}
                              disabled={Boolean(pinningIds[article.id])}
                              title={
                                article.is_pinned
                                  ? 'Quitar fijado'
                                  : 'Fijar arriba de Actualidad'
                              }
                              aria-label={
                                article.is_pinned
                                  ? 'Quitar fijado'
                                  : 'Fijar artículo'
                              }
                              className={`min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                                article.is_pinned
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 hover:bg-amber-500/25'
                                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-amber-600 dark:hover:text-amber-300'
                              }`}
                            >
                              {article.is_pinned ? (
                                <PinOff size={15} aria-hidden="true" />
                              ) : (
                                <Pin size={15} aria-hidden="true" />
                              )}
                            </button>
                          )}

                          {canModerate && (
                            <button
                              type="button"
                              onClick={() => setEditingPost(article)}
                              title="Editar artículo"
                              aria-label="Editar artículo"
                              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                            >
                              <Pencil size={15} aria-hidden="true" />
                            </button>
                          )}

                          {canModerate && confirmDeleteId !== article.id && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(article.id)}
                              title="Eliminar artículo"
                              aria-label="Eliminar artículo"
                              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-red-500/12 hover:text-red-600 dark:hover:text-red-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </button>
                          )}

                          {user?.id !== article.author_id && (
                            <button
                              type="button"
                              onClick={() => handleOpenReport(article)}
                              disabled={reportedPostIds.has(article.id)}
                              title={
                                reportedPostIds.has(article.id)
                                  ? 'Ya reportaste esta publicación'
                                  : 'Reportar noticia falsa o inapropiada'
                              }
                              aria-label="Reportar artículo"
                              className={`min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                                reportedPostIds.has(article.id)
                                  ? 'text-rose-400/70 cursor-default'
                                  : 'text-[var(--text-muted)] hover:bg-rose-500/10 hover:text-rose-400'
                              }`}
                            >
                              <Flag size={14} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>

                      {confirmDeleteId === article.id && (
                        <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] pt-2.5 text-xs">
                          <span className="text-[var(--text-secondary)]">
                            ¿Eliminar artículo?
                          </span>
                          <button
                            type="button"
                            disabled={deletingId === article.id}
                            onClick={() =>
                              void handleConfirmDelete(article.id)
                            }
                            className="min-h-[34px] rounded-lg bg-red-600 px-3 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                          >
                            {deletingId === article.id
                              ? 'Eliminando…'
                              : 'Confirmar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[34px] rounded-lg px-2.5 text-[var(--text-secondary)] hover:text-[var(--text-main)]"
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
    </section>
  );
}
