import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  Clock,
  ExternalLink,
  Eye,
  Flag,
  Globe,
  Heart,
  Link2,
  Loader2,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAchievements } from '../context/AchievementContext';
import { useAuth } from '../context/AuthContext';
import { useSocial } from '../context/SocialContext';
import { ENABLE_AI_FEATURES, summarizeArticleExecutive } from '../lib/ai';
import { fetchUserReportedPostIds } from '../lib/phase2';
import {
  fetchPollForPost,
  recordPostReadingHistory,
  type PostPollData,
} from '../lib/phase3';
import {
  deletePost,
  estimateReadMinutes,
  fetchPostById,
  formatEditorialDate,
  formatRelativeDate,
  getAuthorDisplayName,
  incrementPostViews,
  togglePostLike,
  togglePostPin,
  togglePostVerified,
  type PostRecord,
} from '../lib/posts';
import { Avatar } from './Avatar';
import { CommentSection } from './CommentSection';
import { EditPostModal } from './EditPostModal';
import { FollowButton } from './FollowButton';
import { HashtagText } from './HashtagText';
import { MediaImage } from './MediaImage';
import { OwnerBadge } from './OwnerBadge';
import { PollCard } from './PollCard';
import { ReportPostModal } from './ReportPostModal';
import { VerifiedBadge } from './VerifiedBadge';

interface PostDetailViewProps {
  initialPost: PostRecord;
  onBack: () => void;
  onOpenAuth: () => void;
  onOpenAuthorProfile: (authorId: string) => void;
  onSelectHashtag: (tag: string) => void;
  onPostUpdated: (updated: PostRecord) => void;
  onPostDeleted: (postId: string) => void;
  onOpenAssistant: (post: PostRecord, initialPrompt?: string) => void;
}

export function PostDetailView({
  initialPost,
  onBack,
  onOpenAuth,
  onOpenAuthorProfile,
  onSelectHashtag,
  onPostUpdated,
  onPostDeleted,
  onOpenAssistant,
}: PostDetailViewProps) {
  const { user, isAuthenticated, isOwner, canVerifyNews } = useAuth();
  const { isPostSaved, busySavePostIds, toggleSavePost } = useSocial();
  const { checkReadingHistoryAchievement } = useAchievements();
  const [post, setPost] = useState<PostRecord>(initialPost);
  const [poll, setPoll] = useState<PostPollData | null>(null);
  const [isTogglingLike, setIsTogglingLike] = useState(false);
  const [isTogglingPin, setIsTogglingPin] = useState(false);
  const [isTogglingVerified, setIsTogglingVerified] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [alreadyReported, setAlreadyReported] = useState(false);

  // Resumen ejecutivo inline con IA (3 puntos clave)
  const [aiSummaryText, setAiSummaryText] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const viewedPostIdRef = useRef<string | null>(null);
  const historyRecordedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setPost(initialPost);
    setAiSummaryText(null);
    setSummaryError(null);
  }, [initialPost]);

  useEffect(() => {
    if (!initialPost.id || viewedPostIdRef.current === initialPost.id) return;
    viewedPostIdRef.current = initialPost.id;
    void incrementPostViews(initialPost.id);
    setPost((prev) => ({
      ...prev,
      views_count: (prev.views_count ?? 0) + 1,
    }));
  }, [initialPost.id]);

  // Registra lectura automática en reading_history al abrir un artículo de Actualidad
  useEffect(() => {
    if (!user?.id || initialPost.mode !== 'actualidad' || !initialPost.id) return;
    const key = `${user.id}:${initialPost.id}`;
    if (historyRecordedKeyRef.current === key) return;
    historyRecordedKeyRef.current = key;
    void recordPostReadingHistory(user.id, initialPost.id)
      .then(() => checkReadingHistoryAchievement())
      .catch(() => {
        // Ignora error auxiliar al registrar historial
      });
  }, [user?.id, initialPost.id, initialPost.mode, checkReadingHistoryAchievement]);

  // Carga encuesta interactiva si la publicación pertenece a Comunidad
  useEffect(() => {
    if (initialPost.mode !== 'comunidad' || !initialPost.id) {
      setPoll(null);
      return;
    }
    let active = true;
    fetchPollForPost(initialPost.id, user?.id)
      .then((data) => {
        if (active) setPoll(data);
      })
      .catch(() => {
        if (active) setPoll(null);
      });
    return () => {
      active = false;
    };
  }, [initialPost.id, initialPost.mode, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setAlreadyReported(false);
      return;
    }
    fetchUserReportedPostIds(user.id)
      .then((ids) => setAlreadyReported(ids.includes(initialPost.id)))
      .catch(() => {
        // Ignora error auxiliar
      });
  }, [user?.id, initialPost.id]);

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

  async function handleTogglePin() {
    if (!isOwner || isTogglingPin) return;
    setActionError(null);
    const previous = post;
    const optimistic: PostRecord = {
      ...previous,
      is_pinned: !previous.is_pinned,
    };
    setPost(optimistic);
    onPostUpdated(optimistic);
    setIsTogglingPin(true);

    try {
      await togglePostPin(post.id, optimistic.is_pinned);
    } catch (err) {
      setPost(previous);
      onPostUpdated(previous);
      setActionError(
        err instanceof Error
          ? err.message
          : 'No se pudo cambiar el estado de fijado.'
      );
    } finally {
      setIsTogglingPin(false);
    }
  }

  async function handleConfirmDelete() {
    if (!user) return;
    setActionError(null);
    setIsDeleting(true);
    try {
      await deletePost(post.id, user.id, isOwner);
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

  async function handleToggleVerified() {
    if (!canVerifyNews || isTogglingVerified) return;
    setActionError(null);
    const previous = post;
    const optimistic: PostRecord = {
      ...previous,
      is_verified: !previous.is_verified,
    };
    setPost(optimistic);
    onPostUpdated(optimistic);
    setIsTogglingVerified(true);

    try {
      await togglePostVerified(post.id, optimistic.is_verified);
    } catch (err) {
      setPost(previous);
      onPostUpdated(previous);
      setActionError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la verificación de esta noticia.'
      );
    } finally {
      setIsTogglingVerified(false);
    }
  }

  async function handleGenerateExecutiveSummary() {
    if (!isAuthenticated || !user) {
      onOpenAuth();
      return;
    }
    if (isSummarizing) return;

    setIsSummarizing(true);
    setSummaryError(null);
    try {
      const response = await summarizeArticleExecutive({
        title: post.title,
        category: post.category,
        author: getAuthorDisplayName(post.author),
        content: post.content,
      });
      setAiSummaryText(response.text);
    } catch (err) {
      setSummaryError(
        err instanceof Error
          ? err.message
          : 'No se pudo generar el resumen ejecutivo en este momento.'
      );
    } finally {
      setIsSummarizing(false);
    }
  }

  async function handleToggleSave() {
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }
    await toggleSavePost(post.id);
  }

  const isActualidad = post.mode === 'actualidad';
  const canModerate = Boolean(isOwner || (user && user.id === post.author_id));
  const authorName = getAuthorDisplayName(post.author);
  const readMinutes = estimateReadMinutes(post.content);
  const saved = isPostSaved(post.id);
  const isSavingBookmark = Boolean(busySavePostIds[post.id]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:px-6 md:px-8 md:py-10 md:pb-16">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] -ml-2 inline-flex items-center gap-2 rounded-xl px-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Volver a {isActualidad ? 'Actualidad' : 'Comunidad'}</span>
        </button>

        {((canModerate && !confirmingDelete) ||
          (isActualidad && canVerifyNews && !confirmingDelete)) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {isActualidad && canVerifyNews && (
              <button
                type="button"
                onClick={() => void handleToggleVerified()}
                disabled={isTogglingVerified}
                className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  post.is_verified
                    ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-500 hover:bg-emerald-500/20'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-emerald-500/40 hover:text-emerald-500'
                }`}
              >
                <BadgeCheck size={14} aria-hidden="true" />
                <span>
                  {post.is_verified ? 'Verificada' : 'Verificar noticia'}
                </span>
              </button>
            )}

            {isOwner && (
              <button
                type="button"
                onClick={() => void handleTogglePin()}
                disabled={isTogglingPin}
                className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  post.is_pinned
                    ? 'border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-amber-500/40 hover:text-amber-600 dark:hover:text-amber-300'
                }`}
              >
                {post.is_pinned ? (
                  <>
                    <PinOff size={14} aria-hidden="true" />
                    <span>Quitar fijado</span>
                  </>
                ) : (
                  <>
                    <Pin size={14} aria-hidden="true" />
                    <span>Fijar</span>
                  </>
                )}
              </button>
            )}

            {canModerate && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              >
                <Pencil size={14} aria-hidden="true" />
                <span>Editar</span>
              </button>
            )}

            {canModerate && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              >
                <Trash2 size={14} aria-hidden="true" />
                <span>Eliminar</span>
              </button>
            )}
          </div>
        )}

        {canModerate && confirmingDelete && (
          <div className="flex items-center gap-2 text-xs">
            <span className="hidden sm:inline text-[var(--text-secondary)]">
              ¿Eliminar publicación?
            </span>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              {isDeleting && (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              )}
              <span>Confirmar</span>
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setConfirmingDelete(false)}
              className="min-h-[38px] rounded-lg px-2.5 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {isActualidad ? (
        <article className="border-b border-[var(--border-subtle)] pb-8 transition-colors duration-300">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[var(--accent-primary)]">
            {post.is_pinned && (
              <>
                <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-300">
                  <Pin size={12} aria-hidden="true" />
                  <span>Fijado</span>
                </span>
                <span aria-hidden="true" className="text-[var(--text-muted)]">
                  ·
                </span>
              </>
            )}
            <span className="font-semibold">{post.category}</span>
            <span aria-hidden="true" className="text-[var(--text-muted)]">
              ·
            </span>
            <time
              dateTime={post.created_at}
              className="text-[var(--text-muted)] tabular-nums"
            >
              {formatEditorialDate(post.created_at)}
            </time>
            <span aria-hidden="true" className="text-[var(--text-muted)]">
              ·
            </span>
            <span className="inline-flex items-center gap-1 text-[var(--text-muted)] tabular-nums">
              <Clock size={12} aria-hidden="true" />
              {readMinutes} min de lectura
            </span>
            <span aria-hidden="true" className="text-[var(--text-muted)]">
              ·
            </span>
            <span className="inline-flex items-center gap-1 text-[var(--text-muted)] tabular-nums">
              <Eye size={12} aria-hidden="true" />
              {post.views_count} {post.views_count === 1 ? 'lectura' : 'lecturas'}
            </span>
            {post.is_verified && <VerifiedBadge />}
          </div>

          <h1 className="mt-3 text-balance font-display text-3xl font-bold leading-tight tracking-tight text-[var(--text-main)] sm:text-4xl">
            {post.title || 'Artículo sin título'}
          </h1>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--border-subtle)] py-4 transition-colors duration-300">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => onOpenAuthorProfile(post.author_id)}
                aria-label={`Ver perfil de ${authorName}`}
                className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              >
                <Avatar
                  src={post.author?.avatar_url}
                  name={post.author?.username}
                  size="md"
                />
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenAuthorProfile(post.author_id)}
                    className="text-sm font-semibold text-[var(--text-main)] hover:text-[var(--accent-primary)] transition-colors truncate"
                  >
                    {authorName}
                  </button>
                  <OwnerBadge
                    role={post.author?.role}
                    badge={post.author?.badge}
                    size="sm"
                  />
                  <FollowButton
                    targetUserId={post.author_id}
                    onOpenAuth={onOpenAuth}
                    size="xs"
                  />
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Publicado en Actualidad
                </p>
              </div>
            </div>

            {ENABLE_AI_FEATURES && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleGenerateExecutiveSummary()}
                  disabled={isSummarizing}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-fg)] disabled:opacity-60 transition-colors duration-300"
                >
                  {isSummarizing ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles size={14} aria-hidden="true" />
                  )}
                  <span>
                    {isSummarizing
                      ? 'Resumiendo…'
                      : aiSummaryText
                        ? 'Actualizar resumen IA'
                        : 'Resumir con IA'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onOpenAssistant(
                      post,
                      'Verifica en Google los datos, cifras o hechos más recientes mencionados en este artículo.'
                    )
                  }
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors duration-300"
                >
                  <Globe
                    size={14}
                    className="text-[var(--accent-primary)]"
                    aria-hidden="true"
                  />
                  <span>Verificar datos</span>
                </button>
              </div>
            )}
          </div>

          {/* Tarjeta de Resumen Ejecutivo IA (3 puntos clave) */}
          {ENABLE_AI_FEATURES && (isSummarizing || aiSummaryText || summaryError) && (
            <div className="mt-6 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 sm:p-5 transition-colors duration-300">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-primary)]">
                  <Sparkles size={15} aria-hidden="true" />
                  <span>Resumen Ejecutivo IA · 3 puntos clave</span>
                </div>
                {!isSummarizing && (
                  <button
                    type="button"
                    onClick={() => {
                      setAiSummaryText(null);
                      setSummaryError(null);
                    }}
                    aria-label="Cerrar resumen"
                    className="rounded-lg p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>

              {isSummarizing ? (
                <div className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                  <Loader2
                    size={15}
                    className="animate-spin text-[var(--accent-primary)]"
                    aria-hidden="true"
                  />
                  <span>Analizando el artículo y extrayendo los 3 puntos clave…</span>
                </div>
              ) : summaryError ? (
                <p className="text-xs text-red-500 dark:text-red-300">
                  {summaryError}
                </p>
              ) : (
                <div className="text-sm leading-relaxed text-[var(--text-main)] whitespace-pre-line">
                  {aiSummaryText}
                </div>
              )}
            </div>
          )}

          {/* Fuente de referencia editorial */}
          {(post.source_name || post.source_url) && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-xs transition-colors duration-300">
              <div className="flex items-center gap-2 min-w-0">
                <Link2
                  size={15}
                  className="shrink-0 text-[var(--accent-primary)]"
                  aria-hidden="true"
                />
                <span className="text-[var(--text-muted)]">Fuente de referencia:</span>
                <span className="font-semibold text-[var(--text-main)] truncate">
                  {post.source_name ||
                    (post.source_url
                      ? new URL(post.source_url).hostname.replace(/^www\./, '')
                      : '')}
                </span>
              </div>

              {post.source_url && (
                <a
                  href={post.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-[var(--accent-primary)] hover:underline shrink-0"
                >
                  <span>Abrir enlace original</span>
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              )}
            </div>
          )}

          {post.image_url && (
            <div className="mt-7 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
              <MediaImage
                src={post.image_url}
                alt={post.title || 'Imagen de portada del artículo'}
                className="max-h-[480px] w-full object-cover"
                fallbackClassName="h-64 w-full"
              />
            </div>
          )}

          <div className="mx-auto mt-8 max-w-[68ch] reading-prose text-[var(--text-main)] whitespace-pre-line break-words">
            {post.content}
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-3 pt-4">
            <button
              type="button"
              onClick={handleToggleLike}
              disabled={isTogglingLike}
              aria-pressed={post.liked_by_me}
              className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                post.liked_by_me
                  ? 'border-rose-500/35 bg-rose-500/12 text-rose-600 dark:text-rose-200'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
              }`}
            >
              <Heart
                size={17}
                className={
                  post.liked_by_me
                    ? 'fill-rose-500 text-rose-500 dark:fill-rose-400 dark:text-rose-400'
                    : ''
                }
                aria-hidden="true"
              />
              <span className="tabular-nums">{post.likes_count}</span>
              <span className="text-xs opacity-80">Me gusta</span>
            </button>

            <button
              type="button"
              onClick={() => void handleToggleSave()}
              disabled={isSavingBookmark}
              aria-pressed={saved}
              className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                saved
                  ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
              }`}
            >
              <Bookmark
                size={16}
                className={saved ? 'fill-current' : ''}
                aria-hidden="true"
              />
              <span>{saved ? 'Guardado' : 'Guardar'}</span>
            </button>

            <div className="min-h-[44px] inline-flex items-center gap-2 px-3 text-sm text-[var(--text-muted)]">
              <MessageSquare size={17} aria-hidden="true" />
              <span className="tabular-nums">{post.comments_count}</span>
              <span className="text-xs">
                {post.comments_count === 1 ? 'comentario' : 'comentarios'}
              </span>
            </div>

            {user?.id !== post.author_id && (
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated || !user) {
                    onOpenAuth();
                    return;
                  }
                  setIsReportOpen(true);
                }}
                disabled={alreadyReported}
                className={`ml-auto min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
                  alreadyReported
                    ? 'border-rose-500/25 bg-rose-500/8 text-rose-400 cursor-default'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-rose-500/35 hover:text-rose-400'
                }`}
              >
                <Flag size={13} aria-hidden="true" />
                <span>{alreadyReported ? 'Reportado' : 'Reportar'}</span>
              </button>
            )}
          </div>
        </article>
      ) : (
        <article className="border-b border-[var(--border-subtle)] pb-7 transition-colors duration-300">
          {post.is_pinned && (
            <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-300">
              <Pin size={12} aria-hidden="true" />
              <span>Hilo fijado por el Dueño</span>
            </div>
          )}

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => onOpenAuthorProfile(post.author_id)}
                aria-label={`Ver perfil de ${authorName}`}
                className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              >
                <Avatar
                  src={post.author?.avatar_url}
                  name={post.author?.username}
                  size="md"
                />
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <button
                    type="button"
                    onClick={() => onOpenAuthorProfile(post.author_id)}
                    className="font-semibold text-[var(--text-main)] hover:text-[var(--accent-primary)] transition-colors truncate max-w-[180px]"
                  >
                    {authorName}
                  </button>
                  <OwnerBadge
                    role={post.author?.role}
                    badge={post.author?.badge}
                    size="sm"
                  />
                  <span aria-hidden="true" className="text-[var(--text-muted)]">
                    ·
                  </span>
                  <span className="text-xs font-semibold text-[var(--accent-primary)]">
                    {post.category}
                  </span>
                  <span aria-hidden="true" className="text-[var(--text-muted)]">
                    ·
                  </span>
                  <time
                    dateTime={post.created_at}
                    className="text-xs text-[var(--text-muted)] tabular-nums"
                  >
                    {formatRelativeDate(post.created_at)}
                  </time>
                </div>
              </div>
            </div>

            <FollowButton
              targetUserId={post.author_id}
              onOpenAuth={onOpenAuth}
              size="sm"
            />
          </div>

          {post.title && (
            <h1 className="mt-4 text-balance font-display text-2xl font-bold leading-snug tracking-tight text-[var(--text-main)] sm:text-3xl">
              {post.title}
            </h1>
          )}

          <p className="mt-3.5 reading-prose text-[var(--text-main)] whitespace-pre-line break-words">
            <HashtagText
              text={post.content}
              onSelectHashtag={onSelectHashtag}
            />
          </p>

          {post.image_url && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
              <MediaImage
                src={post.image_url}
                alt={post.title || 'Imagen adjunta al hilo'}
                className="max-h-[480px] w-full object-cover"
                fallbackClassName="h-56 w-full"
              />
            </div>
          )}

          {poll && (
            <PollCard
              poll={poll}
              onOpenAuth={onOpenAuth}
              onPollUpdated={setPoll}
            />
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleToggleLike}
                disabled={isTogglingLike}
                aria-pressed={post.liked_by_me}
                className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  post.liked_by_me
                    ? 'border-rose-500/35 bg-rose-500/12 text-rose-600 dark:text-rose-200'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                }`}
              >
                <Heart
                  size={17}
                  className={
                    post.liked_by_me
                      ? 'fill-rose-500 text-rose-500 dark:fill-rose-400 dark:text-rose-400'
                      : ''
                  }
                  aria-hidden="true"
                />
                <span className="tabular-nums">{post.likes_count}</span>
                <span className="text-xs opacity-80">Me gusta</span>
              </button>

              <button
                type="button"
                onClick={() => void handleToggleSave()}
                disabled={isSavingBookmark}
                aria-pressed={saved}
                className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  saved
                    ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                }`}
              >
                <Bookmark
                  size={16}
                  className={saved ? 'fill-current' : ''}
                  aria-hidden="true"
                />
                <span>{saved ? 'Guardado' : 'Guardar'}</span>
              </button>

              <div className="min-h-[44px] inline-flex items-center gap-2 px-3 text-sm text-[var(--text-muted)]">
                <MessageSquare size={17} aria-hidden="true" />
                <span className="tabular-nums">{post.comments_count}</span>
                <span className="text-xs">
                  {post.comments_count === 1 ? 'comentario' : 'comentarios'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {user?.id !== post.author_id && (
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated || !user) {
                      onOpenAuth();
                      return;
                    }
                    setIsReportOpen(true);
                  }}
                  disabled={alreadyReported}
                  className={`min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
                    alreadyReported
                      ? 'border-rose-500/25 bg-rose-500/8 text-rose-400 cursor-default'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-rose-500/35 hover:text-rose-400'
                  }`}
                >
                  <Flag size={13} aria-hidden="true" />
                  <span>{alreadyReported ? 'Reportado' : 'Reportar'}</span>
                </button>
              )}

              {ENABLE_AI_FEATURES && (
                <button
                  type="button"
                  onClick={() => onOpenAssistant(post)}
                  className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3.5 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-fg)] transition-colors duration-300"
                >
                  <Sparkles size={14} aria-hidden="true" />
                  <span>Consultar / Verificar con IA</span>
                </button>
              )}
            </div>
          </div>
        </article>
      )}

      {actionError && (
        <div
          role="alert"
          className="mt-5 flex items-center gap-2.5 rounded-xl border border-red-500/40 bg-red-500/12 px-4 py-3 text-sm text-red-700 dark:text-red-100"
        >
          <AlertCircle
            size={17}
            className="shrink-0 text-red-500 dark:text-red-400"
            aria-hidden="true"
          />
          <span>{actionError}</span>
        </div>
      )}

      <CommentSection
        postId={post.id}
        onOpenAuth={onOpenAuth}
        onCommentCountChange={handleCommentCountChange}
      />

      <EditPostModal
        post={isEditing ? post : null}
        onClose={() => setIsEditing(false)}
        onSaved={(updated) => {
          setPost(updated);
          onPostUpdated(updated);
        }}
      />

      <ReportPostModal
        isOpen={isReportOpen}
        postId={post.id}
        postTitle={post.title || post.content.slice(0, 80)}
        reporterId={user?.id ?? null}
        onClose={() => setIsReportOpen(false)}
        onSubmitted={() => setAlreadyReported(true)}
      />
    </div>
  );
}
