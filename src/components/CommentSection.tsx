import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  AlertCircle,
  CornerDownRight,
  Loader2,
  MessageSquare,
  Send,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  buildCommentTree,
  createComment,
  deleteComment,
  fetchCommentsForPost,
  formatRelativeDate,
  getAuthorDisplayName,
  type CommentNode,
  type CommentRecord,
} from '../lib/posts';
import { Avatar } from './Avatar';
import { OwnerBadge } from './OwnerBadge';

interface CommentSectionProps {
  postId: string;
  onOpenAuth: () => void;
  onCommentCountChange?: (count: number) => void;
}

const MAX_COMMENT_LENGTH = 1500;

interface CommentItemProps {
  node: CommentNode;
  depth: number;
  currentUserId?: string | null;
  isPlatformOwner: boolean;
  activeReplyId: string | null;
  onToggleReply: (commentId: string | null) => void;
  onSubmitReply: (parentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onOpenAuth: () => void;
}

function CommentItem({
  node,
  depth,
  currentUserId,
  isPlatformOwner,
  activeReplyId,
  onToggleReply,
  onSubmitReply,
  onDeleteComment,
  onOpenAuth,
}: CommentItemProps) {
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isReplying = activeReplyId === node.id;
  const canDelete = Boolean(
    isPlatformOwner || (currentUserId && currentUserId === node.author_id)
  );
  const authorName = getAuthorDisplayName(node.author);

  const indentClass =
    depth === 0
      ? ''
      : depth <= 3
        ? 'ml-4 pl-3.5 sm:ml-7 sm:pl-4 border-l border-[var(--border-subtle)]'
        : 'ml-2 pl-3 sm:ml-5 sm:pl-4 border-l border-[var(--border-subtle)]';

  async function handleReplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReplyError(null);
    const trimmed = replyText.trim();
    if (!trimmed) {
      setReplyError('Escribe una respuesta antes de enviarla.');
      return;
    }

    setIsSendingReply(true);
    try {
      await onSubmitReply(node.id, trimmed);
      setReplyText('');
      onToggleReply(null);
    } catch (err) {
      setReplyError(
        err instanceof Error ? err.message : 'No se pudo enviar la respuesta.'
      );
    } finally {
      setIsSendingReply(false);
    }
  }

  async function handleConfirmDelete() {
    setIsDeleting(true);
    try {
      await onDeleteComment(node.id);
    } finally {
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className={indentClass}>
      <article className="py-3.5">
        <div className="flex items-start gap-3">
          <Avatar
            src={node.author?.avatar_url}
            name={node.author?.username}
            size="sm"
            className="mt-0.5"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className="font-semibold text-[var(--text-main)] truncate max-w-[180px]">
                {authorName}
              </span>
              <OwnerBadge
                role={node.author?.role}
                badge={node.author?.badge}
                size="xs"
              />
              <span aria-hidden="true" className="text-[var(--text-muted)]">
                ·
              </span>
              <time
                dateTime={node.created_at}
                className="text-[var(--text-muted)] tabular-nums"
              >
                {formatRelativeDate(node.created_at)}
              </time>
            </div>

            <p className="mt-1.5 reading-prose-compact text-[var(--text-main)] whitespace-pre-wrap break-words">
              {node.content}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (!currentUserId) {
                    onOpenAuth();
                    return;
                  }
                  setReplyError(null);
                  onToggleReply(isReplying ? null : node.id);
                }}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-2.5 -ml-2.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              >
                <CornerDownRight size={14} aria-hidden="true" />
                <span>{isReplying ? 'Cancelar' : 'Responder'}</span>
              </button>

              {canDelete && !confirmingDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[var(--text-muted)] hover:bg-red-500/12 hover:text-red-600 dark:hover:text-red-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                >
                  <Trash2 size={13} aria-hidden="true" />
                  <span>Eliminar</span>
                </button>
              )}

              {canDelete && confirmingDelete && (
                <div className="inline-flex items-center gap-1.5 pl-1 text-xs">
                  <span className="text-[var(--text-secondary)]">
                    ¿Eliminar comentario?
                  </span>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleConfirmDelete}
                    className="min-h-[32px] rounded-lg bg-red-600 px-2.5 font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                  >
                    {isDeleting ? 'Eliminando…' : 'Confirmar'}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setConfirmingDelete(false)}
                    className="min-h-[32px] rounded-lg px-2 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            {isReplying && (
              <form onSubmit={handleReplySubmit} className="mt-3 space-y-2.5">
                <textarea
                  rows={3}
                  maxLength={MAX_COMMENT_LENGTH}
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder={`Responder a ${authorName}…`}
                  autoFocus
                  className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm leading-relaxed text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25 transition-colors"
                />

                {replyError && (
                  <p role="alert" className="text-xs text-red-600 dark:text-red-300">
                    {replyError}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs tabular-nums text-[var(--text-muted)]">
                    {replyText.length} / {MAX_COMMENT_LENGTH}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyText('');
                        onToggleReply(null);
                      }}
                      className="min-h-[38px] rounded-lg px-3 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSendingReply || !replyText.trim()}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
                    >
                      {isSendingReply ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Send size={13} aria-hidden="true" />
                      )}
                      <span>Responder</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </article>

      {node.replies.length > 0 && (
        <div className="space-y-0.5">
          {node.replies.map((child) => (
            <CommentItem
              key={child.id}
              node={child}
              depth={depth + 1}
              currentUserId={currentUserId}
              isPlatformOwner={isPlatformOwner}
              activeReplyId={activeReplyId}
              onToggleReply={onToggleReply}
              onSubmitReply={onSubmitReply}
              onDeleteComment={onDeleteComment}
              onOpenAuth={onOpenAuth}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentSection({
  postId,
  onOpenAuth,
  onCommentCountChange,
}: CommentSectionProps) {
  const { user, profile, isAuthenticated, isOwner } = useAuth();
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await fetchCommentsForPost(postId);
      setComments(list);
      onCommentCountChange?.(list.length);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los comentarios.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [postId, onCommentCountChange]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  async function handleCreateRootComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }

    setSubmitError(null);
    const trimmed = newComment.trim();
    if (!trimmed) {
      setSubmitError('Escribe un comentario antes de publicarlo.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createComment({
        postId,
        authorId: user.id,
        content: trimmed,
        parentId: null,
      });

      const hydrated: CommentRecord = {
        ...created,
        author: created.author ?? {
          id: user.id,
          username: profile?.username ?? null,
          avatar_url: profile?.avatar_url ?? null,
          role: profile?.role ?? null,
          badge: profile?.badge ?? null,
        },
      };

      setComments((prev) => {
        const next = [...prev, hydrated];
        onCommentCountChange?.(next.length);
        return next;
      });
      setNewComment('');
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'No se pudo publicar el comentario.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitReply(parentId: string, content: string) {
    if (!user) {
      onOpenAuth();
      return;
    }

    const created = await createComment({
      postId,
      authorId: user.id,
      content,
      parentId,
    });

    const hydrated: CommentRecord = {
      ...created,
      author: created.author ?? {
        id: user.id,
        username: profile?.username ?? null,
        avatar_url: profile?.avatar_url ?? null,
        role: profile?.role ?? null,
        badge: profile?.badge ?? null,
      },
    };

    setComments((prev) => {
      const next = [...prev, hydrated];
      onCommentCountChange?.(next.length);
      return next;
    });
  }

  async function handleDeleteComment(commentId: string) {
    if (!user) return;
    try {
      await deleteComment(commentId, user.id, isOwner);
      const refreshed = await fetchCommentsForPost(postId);
      setComments(refreshed);
      onCommentCountChange?.(refreshed.length);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el comentario.'
      );
    }
  }

  return (
    <section aria-labelledby="comments-heading" className="pt-8">
      <div className="flex items-center justify-between gap-4 pb-5">
        <h2
          id="comments-heading"
          className="font-display text-xl font-bold tracking-tight text-[var(--text-main)]"
        >
          Comentarios{' '}
          <span className="text-base font-medium tabular-nums text-[var(--text-muted)]">
            ({comments.length})
          </span>
        </h2>
      </div>

      {isAuthenticated ? (
        <form
          onSubmit={handleCreateRootComment}
          className="mb-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 sm:p-5 transition-colors duration-300"
        >
          <div className="flex items-start gap-3">
            <Avatar
              src={profile?.avatar_url}
              name={profile?.username}
              email={user?.email}
              size="sm"
              className="mt-1"
            />
            <div className="min-w-0 flex-1">
              <label htmlFor="root-comment-input" className="sr-only">
                Escribir un comentario
              </label>
              <textarea
                id="root-comment-input"
                rows={3}
                maxLength={MAX_COMMENT_LENGTH}
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
                placeholder="Comparte tu opinión o aporta a la conversación…"
                className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-3 text-sm leading-relaxed text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25 transition-colors duration-300"
              />

              {submitError && (
                <div
                  role="alert"
                  className="mt-2.5 flex items-center gap-2 text-xs text-red-600 dark:text-red-300"
                >
                  <AlertCircle size={15} aria-hidden="true" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs tabular-nums text-[var(--text-muted)]">
                  {newComment.length} / {MAX_COMMENT_LENGTH}
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting || !newComment.trim()}
                  className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                      <span>Enviando…</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} aria-hidden="true" />
                      <span>Comentar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:flex-row sm:items-center sm:justify-between transition-colors duration-300">
          <p className="text-sm text-[var(--text-secondary)]">
            Inicia sesión para comentar o responder en esta conversación.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="min-h-[44px] shrink-0 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap"
          >
            Iniciar sesión / Registrarse
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4"
            >
              <div className="h-3.5 w-32 rounded bg-[var(--bg-elevated)]" />
              <div className="mt-3 h-4 w-5/6 rounded bg-[var(--bg-subtle)]" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle
              size={18}
              className="shrink-0 text-red-500 dark:text-red-400"
              aria-hidden="true"
            />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadComments()}
            className="min-h-[38px] self-start sm:self-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : commentTree.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-12 text-center transition-colors duration-300">
          <MessageSquare
            size={22}
            className="text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-medium text-[var(--text-main)]">
            Aún no hay comentarios
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Sé la primera persona en abrir el diálogo.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {commentTree.map((rootNode) => (
            <CommentItem
              key={rootNode.id}
              node={rootNode}
              depth={0}
              currentUserId={user?.id}
              isPlatformOwner={isOwner}
              activeReplyId={activeReplyId}
              onToggleReply={setActiveReplyId}
              onSubmitReply={handleSubmitReply}
              onDeleteComment={handleDeleteComment}
              onOpenAuth={onOpenAuth}
            />
          ))}
        </div>
      )}
    </section>
  );
}
