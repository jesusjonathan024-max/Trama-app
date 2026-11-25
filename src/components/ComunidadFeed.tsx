import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Heart,
  MessageSquare,
  PenSquare,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  COMUNIDAD_CATEGORIES,
  deletePost,
  fetchPostsByMode,
  formatRelativeDate,
  getAuthorDisplayName,
  togglePostLike,
  type PostRecord,
} from '../lib/posts';
import { Avatar } from './Avatar';
import { MediaImage } from './MediaImage';

interface ComunidadFeedProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  refreshKey: number;
  syncedPostUpdate: PostRecord | null;
  deletedPostId: string | null;
  onSelectPost: (post: PostRecord) => void;
  onOpenAuth: () => void;
  onOpenCreate: () => void;
}

const FILTER_OPTIONS = ['Todos', ...COMUNIDAD_CATEGORIES] as const;

export function ComunidadFeed({
  selectedCategory,
  onSelectCategory,
  refreshKey,
  syncedPostUpdate,
  deletedPostId,
  onSelectPost,
  onOpenAuth,
  onOpenCreate,
}: ComunidadFeedProps) {
  const { user, isAuthenticated } = useAuth();
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [likingIds, setLikingIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchPostsByMode('comunidad', user?.id);
      setPosts(data);
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
    if (!syncedPostUpdate || syncedPostUpdate.mode !== 'comunidad') return;
    setPosts((prev) =>
      prev.map((item) =>
        item.id === syncedPostUpdate.id ? syncedPostUpdate : item
      )
    );
  }, [syncedPostUpdate]);

  useEffect(() => {
    if (!deletedPostId) return;
    setPosts((prev) => prev.filter((item) => item.id !== deletedPostId));
  }, [deletedPostId]);

  const filteredPosts = useMemo(() => {
    if (selectedCategory === 'Todos') return posts;
    return posts.filter((post) => post.category === selectedCategory);
  }, [posts, selectedCategory]);

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

  async function handleConfirmDelete(postId: string) {
    if (!user) return;
    setDeletingId(postId);
    try {
      await deletePost(postId, user.id);
      setPosts((prev) => prev.filter((item) => item.id !== postId));
      setConfirmDeleteId(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo eliminar el hilo.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section
      aria-labelledby="comunidad-heading"
      className="mx-auto max-w-3xl px-4 py-6 pb-28 sm:px-6 md:px-8 md:py-10 md:pb-20"
    >
      {/* Cabecera + filtro horizontal */}
      <div className="border-b border-white/[0.08] pb-5">
        <div className="flex flex-col gap-4">
          <div>
            <h1
              id="comunidad-heading"
              className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl"
            >
              Comunidad
            </h1>
            <p className="mt-1 text-sm text-[#8F99AB]">
              Hilos rápidos, debates abiertos y conversaciones en vivo.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Filtrar hilos por categoría"
            className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0"
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
                  className={`min-h-[40px] rounded-xl px-3.5 py-2 text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] ${
                    isActive
                      ? 'bg-[#1D2432] text-white border border-white/[0.12]'
                      : 'text-[#8F99AB] border border-transparent hover:bg-white/[0.04] hover:text-[#E5E9F0]'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Feed dinámico de hilos */}
      {isLoading ? (
        <div className="mt-6 space-y-4 animate-pulse">
          {[1, 2, 3].map((row) => (
            <div
              key={row}
              className="rounded-2xl border border-white/[0.07] bg-[#11151D] p-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#1B212E]" />
                <div className="h-4 w-44 rounded bg-[#1B212E]" />
              </div>
              <div className="mt-4 h-4 w-full rounded bg-[#171D29]" />
              <div className="mt-2 h-4 w-3/4 rounded bg-[#171D29]" />
            </div>
          ))}
        </div>
      ) : errorMsg ? (
        <div
          role="alert"
          className="mt-8 flex flex-col gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="shrink-0 text-red-400" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadThreads()}
            className="min-h-[40px] self-start sm:self-auto rounded-xl bg-white/[0.1] px-4 text-xs font-semibold text-white hover:bg-white/[0.16] transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="mx-auto mt-14 flex max-w-md flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-[#10141C] px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#161C27] text-[#7FB2FF]">
            <Users size={22} aria-hidden="true" />
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold text-white">
            {selectedCategory === 'Todos'
              ? 'Todavía no hay hilos en la comunidad'
              : `No hay hilos en ${selectedCategory}`}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#8F99AB]">
            {selectedCategory === 'Todos'
              ? 'Lanza una pregunta, recomendación o debate para encender la conversación.'
              : 'Explora otra categoría o inicia el primer hilo aquí.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {selectedCategory !== 'Todos' && (
              <button
                type="button"
                onClick={() => onSelectCategory('Todos')}
                className="min-h-[44px] rounded-xl border border-white/[0.12] px-4 py-2 text-sm font-medium text-[#E2E7F0] hover:bg-white/[0.05] transition-colors"
              >
                Ver todos los hilos
              </button>
            )}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onOpenCreate}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#388BFF] px-4 py-2 text-sm font-semibold text-[#06101F] hover:bg-[#529BFF] transition-colors"
              >
                <PenSquare size={16} aria-hidden="true" />
                <span>Crear hilo</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="min-h-[44px] rounded-xl bg-[#388BFF] px-4 py-2 text-sm font-semibold text-[#06101F] hover:bg-[#529BFF] transition-colors"
              >
                Iniciar sesión para publicar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {filteredPosts.map((thread) => {
            const isOwner = Boolean(user && user.id === thread.author_id);
            const authorName = getAuthorDisplayName(thread.author);

            return (
              <article
                key={thread.id}
                className="rounded-2xl border border-white/[0.08] bg-[#11151D] p-4 sm:p-5 transition-colors hover:border-white/[0.14]"
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    src={thread.author?.avatar_url}
                    name={thread.author?.username}
                    size="md"
                    className="mt-0.5"
                  />

                  <div className="min-w-0 flex-1">
                    {/* Metadatos del autor y categoría sin píldoras */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className="text-sm font-semibold text-white truncate max-w-[180px]">
                        {authorName}
                      </span>
                      <span aria-hidden="true" className="text-[#566072]">
                        ·
                      </span>
                      <span className="font-medium text-[#7FB2FF]">
                        {thread.category}
                      </span>
                      <span aria-hidden="true" className="text-[#566072]">
                        ·
                      </span>
                      <time
                        dateTime={thread.created_at}
                        className="text-[#8B95A5] tabular-nums"
                      >
                        {formatRelativeDate(thread.created_at)}
                      </time>
                    </div>

                    {/* Contenido clicable que abre la vista dedicada del hilo */}
                    <button
                      type="button"
                      onClick={() => onSelectPost(thread)}
                      className="mt-2 block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] rounded-lg"
                    >
                      {thread.title && (
                        <h2 className="font-display text-lg font-bold leading-snug text-white">
                          {thread.title}
                        </h2>
                      )}
                      <p
                        className={`${
                          thread.title ? 'mt-1.5' : ''
                        } text-[15px] leading-relaxed text-[#DDE3EE] whitespace-pre-line break-words`}
                      >
                        {thread.content}
                      </p>

                      {thread.image_url && (
                        <div className="mt-3.5 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0B0E14]">
                          <MediaImage
                            src={thread.image_url}
                            alt={thread.title || 'Imagen adjunta al hilo'}
                            className="max-h-96 w-full object-cover"
                            fallbackClassName="h-48 w-full"
                          />
                        </div>
                      )}
                    </button>

                    {/* Barra táctil de acciones */}
                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5 -ml-2">
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
                          className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl px-3 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] ${
                            thread.liked_by_me
                              ? 'bg-rose-500/12 text-rose-300'
                              : 'text-[#8F99AB] hover:bg-white/[0.05] hover:text-white'
                          }`}
                        >
                          <Heart
                            size={17}
                            className={
                              thread.liked_by_me
                                ? 'fill-rose-400 text-rose-400'
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
                          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl px-3 text-xs font-medium text-[#8F99AB] hover:bg-white/[0.05] hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
                        >
                          <MessageSquare size={17} aria-hidden="true" />
                          <span className="tabular-nums">
                            {thread.comments_count}
                          </span>
                          <span className="hidden sm:inline">Comentarios</span>
                        </button>
                      </div>

                      {isOwner && confirmDeleteId !== thread.id && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(thread.id)}
                          aria-label="Eliminar hilo"
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-[#7E889B] hover:bg-red-500/10 hover:text-red-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    {confirmDeleteId === thread.id && (
                      <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-white/[0.07] pt-3 text-xs">
                        <span className="text-[#9AA4B6]">
                          ¿Eliminar este hilo?
                        </span>
                        <button
                          type="button"
                          disabled={deletingId === thread.id}
                          onClick={() => void handleConfirmDelete(thread.id)}
                          className="min-h-[36px] rounded-lg bg-red-500/20 px-3 font-medium text-red-200 hover:bg-red-500/30 disabled:opacity-50"
                        >
                          {deletingId === thread.id
                            ? 'Eliminando…'
                            : 'Confirmar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[36px] rounded-lg px-2.5 text-[#9AA4B6] hover:text-white"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
