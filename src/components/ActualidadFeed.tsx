import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Clock,
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
import {
  ACTUALIDAD_CATEGORIES,
  deletePost,
  estimateReadMinutes,
  fetchPostsByMode,
  formatEditorialDate,
  getAuthorDisplayName,
  sortPostsWithPinnedFirst,
  togglePostLike,
  togglePostPin,
  type PostRecord,
} from '../lib/posts';
import { Avatar } from './Avatar';
import { EditPostModal } from './EditPostModal';
import { MediaImage } from './MediaImage';
import { OwnerBadge } from './OwnerBadge';

interface ActualidadFeedProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  refreshKey: number;
  syncedPostUpdate: PostRecord | null;
  deletedPostId: string | null;
  onSelectPost: (post: PostRecord) => void;
  onOpenAuth: () => void;
  onOpenCreate: () => void;
  onOpenAssistant: () => void;
}

const FILTER_OPTIONS = ['Todas', ...ACTUALIDAD_CATEGORIES] as const;

export function ActualidadFeed({
  selectedCategory,
  onSelectCategory,
  refreshKey,
  syncedPostUpdate,
  deletedPostId,
  onSelectPost,
  onOpenAuth,
  onOpenCreate,
  onOpenAssistant,
}: ActualidadFeedProps) {
  const { user, isAuthenticated, isOwner } = useAuth();
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [likingIds, setLikingIds] = useState<Record<string, boolean>>({});
  const [pinningIds, setPinningIds] = useState<Record<string, boolean>>({});
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
    const base =
      selectedCategory === 'Todas'
        ? posts
        : posts.filter((post) => post.category === selectedCategory);
    return sortPostsWithPinnedFirst(base);
  }, [posts, selectedCategory]);

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

            <button
              type="button"
              onClick={onOpenAssistant}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3.5 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-fg)] transition-colors duration-300 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            >
              <Sparkles size={15} aria-hidden="true" />
              <span>Asistente IA</span>
            </button>
          </div>

          <div
            role="tablist"
            aria-label="Filtrar artículos por categoría"
            className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0"
          >
            {FILTER_OPTIONS.map((category) => {
              const isActive = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSelectCategory(category)}
                  className={`min-h-[40px] rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors duration-300 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                    isActive
                      ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)] font-semibold'
                      : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {category}
                </button>
              );
            })}
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
            {selectedCategory === 'Todas'
              ? 'Todavía no hay artículos publicados'
              : `No hay artículos en ${selectedCategory}`}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            {selectedCategory === 'Todas'
              ? 'Publica la primera crónica o análisis editorial para inaugurar la portada.'
              : 'Prueba otra categoría o publica el primer artículo sobre este tema.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {selectedCategory !== 'Todas' && (
              <button
                type="button"
                onClick={() => onSelectCategory('Todas')}
                className="min-h-[44px] rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                Ver todas las categorías
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
            className={`group overflow-hidden rounded-2xl border bg-[var(--bg-card)] shadow-sm transition-colors duration-300 ${
              leadArticle.is_pinned
                ? 'border-amber-500/45 dark:border-amber-400/40'
                : 'border-[var(--border-subtle)] hover:border-[var(--accent-border)]'
            } ${
              leadArticle.image_url
                ? 'grid grid-cols-1 lg:grid-cols-12 items-stretch'
                : 'p-6 sm:p-8'
            }`}
          >
            {leadArticle.image_url && (
              <button
                type="button"
                onClick={() => onSelectPost(leadArticle)}
                className="block w-full overflow-hidden bg-[var(--bg-subtle)] text-left lg:col-span-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary)]"
              >
                <MediaImage
                  src={leadArticle.image_url}
                  alt={leadArticle.title || 'Portada del artículo destacado'}
                  className="h-60 w-full object-cover transition-transform duration-300 group-hover:scale-[1.015] sm:h-80 lg:h-full lg:min-h-[380px]"
                  fallbackClassName="h-60 w-full sm:h-80 lg:h-full lg:min-h-[380px]"
                />
              </button>
            )}

            <div
              className={`flex flex-col justify-between ${
                leadArticle.image_url ? 'p-5 sm:p-7 lg:col-span-5' : 'max-w-3xl'
              }`}
            >
              {/* ZONA 1: CABECERA (Avatar, Autor, Insignia, Categoría y Fecha) */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar
                      src={leadArticle.author?.avatar_url}
                      name={leadArticle.author?.username}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-[var(--text-main)] max-w-[150px]">
                          {getAuthorDisplayName(leadArticle.author)}
                        </span>
                        <OwnerBadge
                          role={leadArticle.author?.role}
                          badge={leadArticle.author?.badge}
                          size="xs"
                        />
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[var(--text-muted)]">
                        <span className="font-semibold text-[var(--accent-primary)]">
                          {leadArticle.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <time
                          dateTime={leadArticle.created_at}
                          className="tabular-nums"
                        >
                          {formatEditorialDate(leadArticle.created_at)}
                        </time>
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

                {/* ZONA 2: CUERPO (Título nítido, Extracto escalable, Tiempo de lectura) */}
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
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] tabular-nums">
                    <Clock size={13} aria-hidden="true" />
                    <span>
                      {estimateReadMinutes(leadArticle.content)} min de lectura
                    </span>
                  </div>
                </button>
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
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                    >
                      <MessageSquare size={15} aria-hidden="true" />
                      <span className="tabular-nums">
                        {leadArticle.comments_count}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-0.5">
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
                    className={`group flex flex-col justify-between overflow-hidden rounded-2xl border bg-[var(--bg-card)] shadow-sm transition-colors duration-300 ${
                      article.is_pinned
                        ? 'border-amber-500/45 dark:border-amber-400/40'
                        : 'border-[var(--border-subtle)] hover:border-[var(--accent-border)]'
                    }`}
                  >
                    <div>
                      {article.image_url && (
                        <button
                          type="button"
                          onClick={() => onSelectPost(article)}
                          className="block w-full overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary)]"
                        >
                          <MediaImage
                            src={article.image_url}
                            alt={article.title || 'Imagen del artículo'}
                            className="aspect-[16/9] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                            fallbackClassName="aspect-[16/9] w-full"
                          />
                        </button>
                      )}

                      <div className="p-5">
                        {/* ZONA 1: CABECERA */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Avatar
                              src={article.author?.avatar_url}
                              name={article.author?.username}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="truncate text-xs font-semibold text-[var(--text-main)] max-w-[150px]">
                                  {getAuthorDisplayName(article.author)}
                                </span>
                                <OwnerBadge
                                  role={article.author?.role}
                                  badge={article.author?.badge}
                                  size="xs"
                                />
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[var(--text-muted)]">
                                <span className="font-semibold text-[var(--accent-primary)]">
                                  {article.category}
                                </span>
                                <span aria-hidden="true">·</span>
                                <time
                                  dateTime={article.created_at}
                                  className="tabular-nums"
                                >
                                  {formatEditorialDate(article.created_at)}
                                </time>
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
                          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] tabular-nums">
                            <Clock size={13} aria-hidden="true" />
                            <span>
                              {estimateReadMinutes(article.content)} min de lectura
                            </span>
                          </div>
                        </button>
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
                            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                          >
                            <MessageSquare size={15} aria-hidden="true" />
                            <span className="tabular-nums">
                              {article.comments_count}
                            </span>
                          </button>
                        </div>

                        <div className="flex items-center gap-0.5">
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
    </section>
  );
}
