import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Heart,
  Loader2,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  deletePost,
  estimateReadMinutes,
  fetchPostById,
  formatEditorialDate,
  formatRelativeDate,
  getAuthorDisplayName,
  togglePostLike,
  type PostRecord,
} from '../lib/posts';
import { Avatar } from './Avatar';
import { CommentSection } from './CommentSection';
import { MediaImage } from './MediaImage';

interface PostDetailViewProps {
  initialPost: PostRecord;
  onBack: () => void;
  onOpenAuth: () => void;
  onPostUpdated: (updated: PostRecord) => void;
  onPostDeleted: (postId: string) => void;
}

export function PostDetailView({
  initialPost,
  onBack,
  onOpenAuth,
  onPostUpdated,
  onPostDeleted,
}: PostDetailViewProps) {
  const { user, isAuthenticated } = useAuth();
  const [post, setPost] = useState<PostRecord>(initialPost);
  const [isTogglingLike, setIsTogglingLike] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setPost(initialPost);
  }, [initialPost]);

  // Refresca el post en segundo plano si cambia el usuario autenticado
  useEffect(() => {
    let active = true;
    async function syncPost() {
      try {
        const fresh = await fetchPostById(initialPost.id, user?.id);
        if (active && fresh) {
          setPost(fresh);
          onPostUpdated(fresh);
        }
      } catch {
        // Conserva el estado actual si falla la sincronización silenciosa
      }
    }
    void syncPost();
    return () => {
      active = false;
    };
  }, [initialPost.id, user?.id, onPostUpdated]);

  const handleCommentCountChange = useCallback(
    (count: number) => {
      setPost((prev) => {
        if (prev.comments_count === count) return prev;
        const next = { ...prev, comments_count: count };
        onPostUpdated(next);
        return next;
      });
    },
    [onPostUpdated]
  );

  async function handleToggleLike() {
    if (!isAuthenticated || !user) {
      onOpenAuth();
      return;
    }
    if (isTogglingLike) return;

    setActionError(null);
    const previous = post;
    const nextLiked = !previous.liked_by_me;
    const nextCount = Math.max(0, previous.likes_count + (nextLiked ? 1 : -1));
    const optimistic: PostRecord = {
      ...previous,
      liked_by_me: nextLiked,
      likes_count: nextCount,
    };

    setPost(optimistic);
    onPostUpdated(optimistic);
    setIsTogglingLike(true);

    try {
      await togglePostLike(post.id, user.id, previous.liked_by_me);
    } catch (err) {
      setPost(previous);
      onPostUpdated(previous);
      setActionError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar tu Me gusta.'
      );
    } finally {
      setIsTogglingLike(false);
    }
  }

  async function handleConfirmDelete() {
    if (!user) return;
    setActionError(null);
    setIsDeleting(true);
    try {
      await deletePost(post.id, user.id);
      onPostDeleted(post.id);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar la publicación.'
      );
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  }

  const isActualidad = post.mode === 'actualidad';
  const isOwner = Boolean(user && user.id === post.author_id);
  const authorName = getAuthorDisplayName(post.author);
  const readMinutes = isActualidad ? estimateReadMinutes(post.content) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-28 sm:px-6 md:px-8 md:py-10 md:pb-16">
      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] -ml-2 inline-flex items-center gap-2 rounded-xl px-2.5 text-sm font-medium text-[#9AA4B6] hover:bg-white/[0.05] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Volver a {isActualidad ? 'Actualidad' : 'Comunidad'}</span>
        </button>

        {isOwner && !confirmingDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-white/[0.09] px-3 text-xs font-medium text-[#9AA4B6] hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
          >
            <Trash2 size={14} aria-hidden="true" />
            <span>Eliminar</span>
          </button>
        )}

        {isOwner && confirmingDelete && (
          <div className="flex items-center gap-2 text-xs">
            <span className="hidden sm:inline text-[#9AA4B6]">
              ¿Eliminar publicación?
            </span>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 font-medium text-red-200 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
            >
              {isDeleting && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
              <span>Confirmar</span>
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setConfirmingDelete(false)}
              className="min-h-[38px] rounded-lg px-2.5 text-[#9AA4B6] hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {isActualidad ? (
        <article className="border-b border-white/[0.08] pb-8">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#7FB2FF]">
            <span>{post.category}</span>
            <span aria-hidden="true" className="text-[#566072]">
              ·
            </span>
            <time dateTime={post.created_at} className="text-[#8B95A5] tabular-nums">
              {formatEditorialDate(post.created_at)}
            </time>
            {readMinutes && (
              <>
                <span aria-hidden="true" className="text-[#566072]">
                  ·
                </span>
                <span className="text-[#8B95A5] tabular-nums">
                  {readMinutes} min de lectura
                </span>
              </>
            )}
          </div>

          <h1 className="mt-3 text-balance font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
            {post.title || 'Artículo sin título'}
          </h1>

          <div className="mt-6 flex items-center gap-3 border-y border-white/[0.07] py-4">
            <Avatar
              src={post.author?.avatar_url}
              name={post.author?.username}
              size="md"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#EEF2F8] truncate">
                {authorName}
              </p>
              <p className="text-xs text-[#8B95A5]">
                Publicado en Actualidad
              </p>
            </div>
          </div>

          {post.image_url && (
            <div className="mt-7 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#11151D]">
              <MediaImage
                src={post.image_url}
                alt={post.title || 'Imagen de portada del artículo'}
                className="max-h-[480px] w-full object-cover"
                fallbackClassName="h-64 w-full"
              />
            </div>
          )}

          <div className="mx-auto mt-8 max-w-[68ch] text-[16px] leading-[1.82] text-[#DCE2EC] whitespace-pre-line break-words">
            {post.content}
          </div>

          <div className="mt-9 flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={handleToggleLike}
              disabled={isTogglingLike}
              aria-pressed={post.liked_by_me}
              className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] ${
                post.liked_by_me
                  ? 'border-rose-400/35 bg-rose-500/12 text-rose-200'
                  : 'border-white/[0.1] bg-[#121620] text-[#CBD5E1] hover:border-white/[0.2] hover:text-white'
              }`}
            >
              <Heart
                size={17}
                className={post.liked_by_me ? 'fill-rose-400 text-rose-400' : ''}
                aria-hidden="true"
              />
              <span className="tabular-nums">{post.likes_count}</span>
              <span className="text-xs opacity-80">Me gusta</span>
            </button>

            <div className="min-h-[44px] inline-flex items-center gap-2 px-3 text-sm text-[#8B95A5]">
              <MessageSquare size={17} aria-hidden="true" />
              <span className="tabular-nums">{post.comments_count}</span>
              <span className="text-xs">
                {post.comments_count === 1 ? 'comentario' : 'comentarios'}
              </span>
            </div>
          </div>
        </article>
      ) : (
        <article className="border-b border-white/[0.08] pb-7">
          <div className="flex items-center gap-3">
            <Avatar
              src={post.author?.avatar_url}
              name={post.author?.username}
              size="md"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                <span className="font-semibold text-white truncate max-w-[200px]">
                  {authorName}
                </span>
                <span aria-hidden="true" className="text-[#566072]">
                  ·
                </span>
                <span className="text-xs font-medium text-[#7FB2FF]">
                  {post.category}
                </span>
                <span aria-hidden="true" className="text-[#566072]">
                  ·
                </span>
                <time
                  dateTime={post.created_at}
                  className="text-xs text-[#8B95A5] tabular-nums"
                >
                  {formatRelativeDate(post.created_at)}
                </time>
              </div>
            </div>
          </div>

          {post.title && (
            <h1 className="mt-4 text-balance font-display text-2xl font-bold leading-snug tracking-tight text-white sm:text-3xl">
              {post.title}
            </h1>
          )}

          <p className="mt-3.5 text-[15.5px] leading-relaxed text-[#E2E8F0] whitespace-pre-line break-words">
            {post.content}
          </p>

          {post.image_url && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#11151D]">
              <MediaImage
                src={post.image_url}
                alt={post.title || 'Imagen adjunta al hilo'}
                className="max-h-[480px] w-full object-cover"
                fallbackClassName="h-56 w-full"
              />
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleLike}
              disabled={isTogglingLike}
              aria-pressed={post.liked_by_me}
              className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] ${
                post.liked_by_me
                  ? 'border-rose-400/35 bg-rose-500/12 text-rose-200'
                  : 'border-white/[0.1] bg-[#121620] text-[#CBD5E1] hover:border-white/[0.2] hover:text-white'
              }`}
            >
              <Heart
                size={17}
                className={post.liked_by_me ? 'fill-rose-400 text-rose-400' : ''}
                aria-hidden="true"
              />
              <span className="tabular-nums">{post.likes_count}</span>
              <span className="text-xs opacity-80">Me gusta</span>
            </button>

            <div className="min-h-[44px] inline-flex items-center gap-2 px-3 text-sm text-[#8B95A5]">
              <MessageSquare size={17} aria-hidden="true" />
              <span className="tabular-nums">{post.comments_count}</span>
              <span className="text-xs">
                {post.comments_count === 1 ? 'comentario' : 'comentarios'}
              </span>
            </div>
          </div>
        </article>
      )}

      {actionError && (
        <div
          role="alert"
          className="mt-5 flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          <AlertCircle size={17} className="shrink-0 text-red-400" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      <CommentSection
        postId={post.id}
        onOpenAuth={onOpenAuth}
        onCommentCountChange={handleCommentCountChange}
      />
    </div>
  );
}
