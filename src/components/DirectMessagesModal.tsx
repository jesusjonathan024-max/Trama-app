import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCheck,
  Loader2,
  Mail,
  MessageSquarePlus,
  RefreshCw,
  Search,
  Send,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchConversationMessages,
  fetchDirectConversations,
  fetchRegisteredUsersDirectory,
  markConversationRead,
  sendDirectMessage,
  type ConversationSummary,
  type DirectMessageRecord,
} from '../lib/phase4';
import {
  formatRelativeDate,
  getAuthorDisplayName,
  type PostAuthor,
} from '../lib/posts';
import { Avatar } from './Avatar';
import { OwnerBadge } from './OwnerBadge';

interface DirectMessagesModalProps {
  isOpen: boolean;
  initialPartner: PostAuthor | null;
  onClose: () => void;
  onOpenProfile?: (userId: string) => void;
  onUnreadChanged?: () => void;
}

export function DirectMessagesModal({
  isOpen,
  initialPartner,
  onClose,
  onOpenProfile,
  onUnreadChanged,
}: DirectMessagesModalProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(
    null
  );

  const [activePartner, setActivePartner] = useState<PostAuthor | null>(null);
  const [messages, setMessages] = useState<DirectMessageRecord[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Búsqueda de usuarios para iniciar un hilo nuevo
  const [isNewChatMode, setIsNewChatMode] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [directoryUsers, setDirectoryUsers] = useState<PostAuthor[]>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingConversations(true);
    setConversationsError(null);
    try {
      const list = await fetchDirectConversations(user.id);
      setConversations(list);
    } catch (err) {
      setConversationsError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar tus mensajes privados.'
      );
    } finally {
      setIsLoadingConversations(false);
    }
  }, [user?.id]);

  const loadThread = useCallback(
    async (partnerId: string, silent = false) => {
      if (!user?.id || !partnerId) return;
      if (!silent) {
        setIsLoadingThread(true);
      }
      setThreadError(null);
      try {
        const list = await fetchConversationMessages(user.id, partnerId);
        setMessages(list);

        const hasUnreadIncoming = list.some(
          (m) => m.recipient_id === user.id && !m.is_read
        );
        if (hasUnreadIncoming) {
          await markConversationRead(user.id, partnerId);
          setMessages((prev) =>
            prev.map((m) =>
              m.recipient_id === user.id ? { ...m, is_read: true } : m
            )
          );
          setConversations((prev) =>
            prev.map((c) =>
              c.partner.id === partnerId ? { ...c, unreadCount: 0 } : c
            )
          );
          onUnreadChanged?.();
        }
      } catch (err) {
        setThreadError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar la conversación.'
        );
      } finally {
        if (!silent) {
          setIsLoadingThread(false);
        }
      }
    },
    [user?.id, onUnreadChanged]
  );

  // Abre con el destinatario inicial (ej. botón "Mensaje" en PublicProfileView)
  useEffect(() => {
    if (!isOpen || !user?.id) return;
    void loadConversations();
    if (initialPartner && initialPartner.id !== user.id) {
      setActivePartner(initialPartner);
      setIsNewChatMode(false);
    }
  }, [isOpen, user?.id, initialPartner, loadConversations]);

  // Carga mensajes al seleccionar conversación + sondeo ligero cada 8s mientras esté abierto
  useEffect(() => {
    if (!isOpen || !user?.id || !activePartner?.id) return;
    void loadThread(activePartner.id, false);

    const timer = window.setInterval(() => {
      void loadThread(activePartner.id, true);
      void loadConversations();
    }, 8000);

    return () => window.clearInterval(timer);
  }, [isOpen, user?.id, activePartner?.id, loadThread, loadConversations]);

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (!isOpen || !activePartner) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isOpen, activePartner]);

  // Escape para cerrar
  useEffect(() => {
    if (!isOpen) return;
    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Directorio de usuarios para nuevo chat
  useEffect(() => {
    if (!isOpen || !isNewChatMode || !user?.id) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setIsLoadingDirectory(true);
      try {
        const users = await fetchRegisteredUsersDirectory(user.id, userSearch);
        if (active) setDirectoryUsers(users);
      } catch {
        if (active) setDirectoryUsers([]);
      } finally {
        if (active) setIsLoadingDirectory(false);
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isOpen, isNewChatMode, user?.id, userSearch]);

  if (!isOpen || !user) return null;

  async function handleSendMessage(event?: FormEvent) {
    event?.preventDefault();
    if (!user || !activePartner || isSending) return;
    const text = draft.trim();
    if (!text) return;

    setIsSending(true);
    setThreadError(null);
    try {
      const sent = await sendDirectMessage({
        senderId: user.id,
        recipientId: activePartner.id,
        content: text,
      });
      setMessages((prev) => [...prev, sent]);
      setDraft('');
      setConversations((prev) => {
        const filtered = prev.filter((c) => c.partner.id !== activePartner.id);
        return [
          {
            partner: activePartner,
            lastMessage: sent,
            unreadCount: 0,
          },
          ...filtered,
        ];
      });
    } catch (err) {
      setThreadError(
        err instanceof Error ? err.message : 'No se pudo enviar el mensaje.'
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDownInput(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  }

  const partnerDisplayName = activePartner
    ? getAuthorDisplayName(activePartner)
    : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="direct-messages-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-sm"
    >
      <div className="flex h-[88dvh] max-h-[720px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl transition-colors duration-300">
        {/* Barra superior del modal */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Mail size={18} aria-hidden="true" />
            </div>
            <div>
              <h2
                id="direct-messages-heading"
                className="font-display text-lg font-bold tracking-tight text-[var(--text-main)]"
              >
                Mensajes Directos
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Conversaciones privadas entre miembros de Trama
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsNewChatMode((prev) => !prev);
                setUserSearch('');
              }}
              className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                isNewChatMode
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <MessageSquarePlus size={14} aria-hidden="true" />
              <span className="hidden sm:inline">Nuevo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void loadConversations();
                if (activePartner) void loadThread(activePartner.id, false);
              }}
              aria-label="Actualizar conversaciones"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors"
            >
              <RefreshCw
                size={15}
                className={isLoadingConversations ? 'animate-spin' : ''}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar mensajes directos"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Cuerpo dividido: Lista de conversaciones + Hilo activo */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Panel izquierdo: Conversaciones o Buscador de nuevo chat */}
          <aside
            className={`w-full flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 md:flex md:w-80 shrink-0 ${
              activePartner && !isNewChatMode ? 'hidden' : 'flex'
            }`}
          >
            {isNewChatMode ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="border-b border-[var(--border-subtle)] p-3">
                  <div className="relative">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Buscar usuario para escribir…"
                      aria-label="Buscar usuario"
                      className="min-h-[40px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] pl-8 pr-3 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                  {isLoadingDirectory ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--text-muted)]">
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      <span>Buscando miembros…</span>
                    </div>
                  ) : directoryUsers.length === 0 ? (
                    <p className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                      No encontramos usuarios con ese nombre.
                    </p>
                  ) : (
                    directoryUsers.map((person) => {
                      const label = getAuthorDisplayName(person);
                      return (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => {
                            setActivePartner(person);
                            setIsNewChatMode(false);
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-elevated)] transition-colors"
                        >
                          <Avatar src={person.avatar_url} name={label} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-semibold text-[var(--text-main)]">
                                {label}
                              </span>
                              <OwnerBadge
                                role={person.role}
                                badge={person.badge}
                                size="xs"
                              />
                            </div>
                            <p className="text-[11px] text-[var(--text-muted)]">
                              Tocar para iniciar chat
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                {conversationsError && (
                  <div className="p-3 text-xs text-red-600 dark:text-red-300">
                    {conversationsError}
                  </div>
                )}

                {isLoadingConversations && conversations.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-xs text-[var(--text-muted)]">
                    <Loader2 size={15} className="animate-spin text-[var(--accent-primary)]" aria-hidden="true" />
                    <span>Cargando chats…</span>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <Mail
                      size={24}
                      className="mx-auto text-[var(--text-muted)]"
                      aria-hidden="true"
                    />
                    <p className="mt-2.5 text-sm font-semibold text-[var(--text-main)]">
                      Sin conversaciones aún
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Usa el botón Nuevo arriba o toca Mensaje en cualquier perfil para empezar.
                    </p>
                  </div>
                ) : (
                  conversations.map((conv) => {
                    const isSelected = activePartner?.id === conv.partner.id;
                    const name = getAuthorDisplayName(conv.partner);
                    const sentByMe = conv.lastMessage.sender_id === user.id;

                    return (
                      <button
                        key={conv.partner.id}
                        type="button"
                        onClick={() => setActivePartner(conv.partner)}
                        className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors ${
                          isSelected
                            ? 'bg-[var(--accent-soft)]'
                            : 'hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        <Avatar src={conv.partner.avatar_url} name={name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="truncate text-xs font-bold text-[var(--text-main)]">
                                {name}
                              </span>
                              <OwnerBadge
                                role={conv.partner.role}
                                badge={conv.partner.badge}
                                size="xs"
                              />
                            </div>
                            <span className="shrink-0 text-[10px] tabular-nums text-[var(--text-muted)]">
                              {formatRelativeDate(conv.lastMessage.created_at)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p
                              className={`truncate text-xs ${
                                conv.unreadCount > 0
                                  ? 'font-semibold text-[var(--text-main)]'
                                  : 'text-[var(--text-secondary)]'
                              }`}
                            >
                              {sentByMe ? 'Tú: ' : ''}
                              {conv.lastMessage.content}
                            </p>
                            {conv.unreadCount > 0 && (
                              <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)] px-1.5 text-[10px] font-bold text-[var(--accent-fg)] tabular-nums">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </aside>

          {/* Panel derecho: Hilo de conversación activo */}
          <div
            className={`min-w-0 flex-1 flex-col bg-[var(--bg-card)] ${
              activePartner && !isNewChatMode ? 'flex' : 'hidden md:flex'
            }`}
          >
            {!activePartner ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                  <Mail size={22} aria-hidden="true" />
                </div>
                <h3 className="mt-3 font-display text-lg font-bold text-[var(--text-main)]">
                  Selecciona una conversación
                </h3>
                <p className="mt-1 max-w-xs text-xs text-[var(--text-muted)]">
                  Elige un chat de la izquierda o presiona Nuevo para escribirle a cualquier miembro registrado.
                </p>
              </div>
            ) : (
              <>
                {/* Cabecera del chat */}
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setActivePartner(null)}
                      aria-label="Volver a conversaciones"
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] md:hidden"
                    >
                      <ArrowLeft size={18} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenProfile) {
                          onClose();
                          onOpenProfile(activePartner.id);
                        }
                      }}
                      className="flex items-center gap-2.5 min-w-0 text-left group"
                    >
                      <Avatar
                        src={activePartner.avatar_url}
                        name={partnerDisplayName}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-[var(--text-main)] group-hover:text-[var(--accent-primary)] transition-colors">
                            {partnerDisplayName}
                          </span>
                          <OwnerBadge
                            role={activePartner.role}
                            badge={activePartner.badge}
                            size="xs"
                          />
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Ver perfil público
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Lista de mensajes */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
                  {threadError && (
                    <div
                      role="alert"
                      className="flex items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200"
                    >
                      <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
                      <span>{threadError}</span>
                    </div>
                  )}

                  {isLoadingThread && messages.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-xs text-[var(--text-muted)]">
                      <Loader2 size={15} className="animate-spin text-[var(--accent-primary)]" aria-hidden="true" />
                      <span>Cargando mensajes…</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                      Envía el primer mensaje para iniciar tu conversación con{' '}
                      <strong className="text-[var(--text-main)]">
                        {partnerDisplayName}
                      </strong>
                      .
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMine = msg.sender_id === user.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            isMine ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div
                            className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                              isMine
                                ? 'rounded-br-sm bg-[var(--accent-primary)] text-[var(--accent-fg)]'
                                : 'rounded-bl-sm border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-main)]'
                            }`}
                          >
                            {msg.content}
                          </div>
                          <div className="mt-1 flex items-center gap-1 px-1 text-[10px] text-[var(--text-muted)] tabular-nums">
                            <span>{formatRelativeDate(msg.created_at)}</span>
                            {isMine && msg.is_read && (
                              <CheckCheck
                                size={11}
                                className="text-[var(--accent-primary)]"
                                aria-label="Leído"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Compositor */}
                <form
                  onSubmit={(e) => void handleSendMessage(e)}
                  className="border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-3"
                >
                  <div className="flex items-end gap-2">
                    <textarea
                      rows={1}
                      maxLength={2000}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDownInput}
                      placeholder={`Escribe un mensaje a ${partnerDisplayName}…`}
                      aria-label="Escribe un mensaje privado"
                      className="max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25"
                    />
                    <button
                      type="submit"
                      disabled={isSending || !draft.trim()}
                      aria-label="Enviar mensaje"
                      className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
                    >
                      {isSending ? (
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Send size={16} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
