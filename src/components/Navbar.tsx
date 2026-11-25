import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  BookOpen,
  CheckCheck,
  Gamepad2,
  Heart,
  Loader2,
  MessageSquare,
  Moon,
  Newspaper,
  Plus,
  RefreshCw,
  Sun,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  fetchUserNotifications,
  markNotificationsSeenNow,
  type NotificationItem,
} from '../lib/notifications';
import { formatRelativeDate } from '../lib/posts';
import { AppearanceControls } from './AppearanceControls';
import { Avatar } from './Avatar';
import { OwnerBadge } from './OwnerBadge';

export type AppMode = 'actualidad' | 'comunidad' | 'biblioteca' | 'arcade';
export type ActiveView = AppMode | 'perfil';

export interface ModeDefinition {
  id: AppMode;
  label: string;
  description: string;
}

export const APP_MODES: ModeDefinition[] = [
  {
    id: 'actualidad',
    label: 'Actualidad',
    description:
      'Noticias, publicaciones recientes y análisis curados para mantenerte al día.',
  },
  {
    id: 'comunidad',
    label: 'Comunidad',
    description:
      'Debates, comentarios y conversaciones compartidas entre lectores y creadores.',
  },
  {
    id: 'biblioteca',
    label: 'Biblioteca',
    description:
      'Series, capítulos y lecturas organizadas para explorar a tu propio ritmo.',
  },
  {
    id: 'arcade',
    label: 'Arcade',
    description:
      'Minijuegos retro-fantasía jugables al instante en el navegador.',
  },
];

const NAV_ITEMS: Array<{
  id: ActiveView;
  label: string;
  icon: typeof Newspaper;
}> = [
  { id: 'actualidad', label: 'Actualidad', icon: Newspaper },
  { id: 'comunidad', label: 'Comunidad', icon: Users },
  { id: 'biblioteca', label: 'Biblioteca', icon: BookOpen },
  { id: 'arcade', label: 'Arcade', icon: Gamepad2 },
  { id: 'perfil', label: 'Perfil', icon: UserRound },
];

interface NavbarProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  onOpenAuth: () => void;
  onOpenCreate: () => void;
  onOpenNotificationPost: (postId: string) => void;
}

export function Navbar({
  activeView,
  onSelectView,
  onOpenAuth,
  onOpenCreate,
  onOpenNotificationPost,
}: NavbarProps) {
  const { isAuthenticated, isLoadingSession, user, profile } = useAuth();
  const { themeMode } = useTheme();
  const displayName = profile?.username?.trim() || 'Mi Perfil';

  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(
    null
  );

  const appearanceContainerRef = useRef<HTMLDivElement | null>(null);
  const notificationsContainerRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = notifications.filter((item) => item.isUnread).length;

  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }
    setIsLoadingNotifications(true);
    setNotificationsError(null);
    try {
      const items = await fetchUserNotifications(user.id, 18);
      setNotifications(items);
    } catch (err) {
      setNotificationsError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar tus notificaciones.'
      );
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setIsNotificationsOpen(false);
      return;
    }
    void loadNotifications();

    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [user?.id, loadNotifications]);

  // Cierra popovers al hacer clic fuera o presionar Escape
  useEffect(() => {
    if (!isAppearanceOpen && !isNotificationsOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        isAppearanceOpen &&
        appearanceContainerRef.current &&
        !appearanceContainerRef.current.contains(target)
      ) {
        setIsAppearanceOpen(false);
      }
      if (
        isNotificationsOpen &&
        notificationsContainerRef.current &&
        !notificationsContainerRef.current.contains(target)
      ) {
        setIsNotificationsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsAppearanceOpen(false);
        setIsNotificationsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAppearanceOpen, isNotificationsOpen]);

  function handleMarkAllRead() {
    if (!user?.id) return;
    markNotificationsSeenNow(user.id);
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, isUnread: false }))
    );
  }

  function handleToggleNotifications() {
    setIsAppearanceOpen(false);
    setIsNotificationsOpen((prev) => {
      const next = !prev;
      if (next && user?.id) {
        void loadNotifications();
      }
      return next;
    });
  }

  function handleToggleAppearance() {
    setIsNotificationsOpen(false);
    setIsAppearanceOpen((prev) => !prev);
  }

  function handleClickNotification(item: NotificationItem) {
    if (user?.id) {
      markNotificationsSeenNow(user.id);
      setNotifications((prev) =>
        prev.map((entry) => ({ ...entry, isUnread: false }))
      );
    }
    setIsNotificationsOpen(false);
    onOpenNotificationPost(item.postId);
  }

  return (
    <>
      {/* Encabezado principal superior */}
      <header className="relative z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] transition-colors duration-300">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-6">
          <button
            type="button"
            onClick={() => onSelectView('actualidad')}
            className="font-display text-xl font-bold tracking-tight text-[var(--text-main)] hover:text-[var(--accent-primary)] transition-colors duration-300 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded-md px-1 -ml-1"
          >
            Trama
          </button>

          <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
            {/* Botón "+ Crear" siempre accesible */}
            <button
              type="button"
              onClick={onOpenCreate}
              aria-label="Crear publicación"
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-xs sm:px-3.5 sm:text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all duration-300 whitespace-nowrap shrink-0 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]"
            >
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
              <span>Crear</span>
            </button>

            {/* Selector rápido de Apariencia (Tema, Acento y Letra) */}
            <div ref={appearanceContainerRef} className="relative">
              <button
                type="button"
                onClick={handleToggleAppearance}
                aria-expanded={isAppearanceOpen}
                aria-haspopup="dialog"
                aria-label="Apariencia y lectura"
                title="Apariencia y tamaño de letra"
                className={`min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  isAppearanceOpen
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                {themeMode === 'dark' ? (
                  <Moon size={17} aria-hidden="true" />
                ) : (
                  <Sun size={17} aria-hidden="true" />
                )}
              </button>

              {isAppearanceOpen && (
                <div
                  role="dialog"
                  aria-label="Ajustes rápidos de apariencia"
                  className="fixed inset-x-3 top-16 z-50 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-2xl transition-colors duration-300 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80"
                >
                  <div className="mb-3 flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
                    <div>
                      <p className="font-display text-sm font-bold text-[var(--text-main)]">
                        Apariencia
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Se guarda automáticamente en tu cuenta
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAppearanceOpen(false)}
                      aria-label="Cerrar ajustes de apariencia"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors"
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </div>
                  <AppearanceControls compact />
                </div>
              )}
            </div>

            {/* Campana de Notificaciones (visible para usuarios autenticados) */}
            {isAuthenticated && (
              <div ref={notificationsContainerRef} className="relative">
                <button
                  type="button"
                  onClick={handleToggleNotifications}
                  aria-expanded={isNotificationsOpen}
                  aria-haspopup="dialog"
                  aria-label={
                    unreadCount > 0
                      ? `Notificaciones (${unreadCount} nuevas)`
                      : 'Notificaciones'
                  }
                  title="Notificaciones"
                  className={`relative min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                    isNotificationsOpen
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  <Bell size={17} aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--accent-primary)] px-1 text-[10px] font-bold leading-none text-[var(--accent-fg)] ring-2 ring-[var(--bg-base)]">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div
                    role="dialog"
                    aria-label="Notificaciones recientes"
                    className="fixed inset-x-3 top-16 z-50 flex max-h-[75dvh] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl transition-colors duration-300 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-display text-sm font-bold text-[var(--text-main)]">
                          Notificaciones
                        </p>
                        {unreadCount > 0 && (
                          <span className="rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--accent-primary)]">
                            {unreadCount} nuevas
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            title="Marcar todas como leídas"
                            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-[var(--accent-primary)] hover:bg-[var(--accent-soft)] transition-colors"
                          >
                            <CheckCheck size={13} aria-hidden="true" />
                            <span>Leídas</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void loadNotifications()}
                          disabled={isLoadingNotifications}
                          aria-label="Actualizar notificaciones"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] disabled:opacity-50 transition-colors"
                        >
                          <RefreshCw
                            size={14}
                            className={
                              isLoadingNotifications ? 'animate-spin' : ''
                            }
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                      {isLoadingNotifications && notifications.length === 0 ? (
                        <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-[var(--text-muted)]">
                          <Loader2
                            size={15}
                            className="animate-spin text-[var(--accent-primary)]"
                            aria-hidden="true"
                          />
                          <span>Buscando actividad reciente…</span>
                        </div>
                      ) : notificationsError ? (
                        <div className="px-4 py-6 text-center text-xs text-red-600 dark:text-red-300">
                          {notificationsError}
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <Bell
                            size={22}
                            className="mx-auto text-[var(--text-muted)]"
                            aria-hidden="true"
                          />
                          <p className="mt-2.5 text-sm font-medium text-[var(--text-main)]">
                            Sin actividad todavía
                          </p>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            Aquí aparecerán comentarios y Me gusta en tus publicaciones.
                          </p>
                        </div>
                      ) : (
                        notifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleClickNotification(item)}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-elevated)] ${
                              item.isUnread ? 'bg-[var(--accent-soft)]/50' : ''
                            }`}
                          >
                            <div className="relative shrink-0 mt-0.5">
                              <Avatar
                                src={item.actorAvatar}
                                name={item.actorName}
                                size="sm"
                              />
                              <span
                                aria-hidden="true"
                                className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-[var(--bg-card)] ${
                                  item.kind === 'like'
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-[var(--accent-primary)] text-[var(--accent-fg)]'
                                }`}
                              >
                                {item.kind === 'like' ? (
                                  <Heart size={9} className="fill-current" />
                                ) : (
                                  <MessageSquare size={9} />
                                )}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="truncate text-xs font-semibold text-[var(--text-main)]">
                                    {item.actorName}
                                  </span>
                                  <OwnerBadge
                                    role={item.actorRole}
                                    badge={item.actorBadge}
                                    size="xs"
                                  />
                                </div>
                                <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">
                                  {formatRelativeDate(item.createdAt)}
                                </span>
                              </div>

                              <p className="mt-0.5 text-xs text-[var(--text-secondary)] leading-snug">
                                {item.kind === 'like'
                                  ? 'Le gustó tu publicación '
                                  : 'Comentó en '}
                                <span className="font-medium text-[var(--text-main)]">
                                  “{item.postTitle}”
                                </span>
                              </p>

                              {item.excerpt && (
                                <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">
                                  “{item.excerpt}”
                                </p>
                              )}
                            </div>

                            {item.isUnread && (
                              <span
                                aria-label="No leída"
                                className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--accent-primary)]"
                              />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Acceso a Perfil / Sesión */}
            {isLoadingSession ? (
              <div
                aria-label="Verificando sesión"
                className="h-10 w-24 sm:w-36 rounded-xl bg-[var(--bg-elevated)] animate-pulse"
              />
            ) : isAuthenticated ? (
              <button
                type="button"
                onClick={() => onSelectView('perfil')}
                aria-current={activeView === 'perfil' ? 'page' : undefined}
                className={`min-h-[40px] flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm font-medium transition-colors duration-300 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  activeView === 'perfil'
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--text-main)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-main)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <Avatar
                  src={profile?.avatar_url}
                  name={profile?.username}
                  email={user?.email}
                  size="sm"
                />
                <span className="hidden sm:inline max-w-[130px] truncate">
                  {displayName}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="min-h-[40px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-xs sm:px-3.5 sm:text-sm font-semibold text-[var(--text-main)] hover:bg-[var(--bg-elevated)] active:scale-[0.98] transition-all duration-300 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              >
                <span className="sm:hidden">Entrar</span>
                <span className="hidden sm:inline">Iniciar sesión</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Barra horizontal superior fija con las 5 secciones (sin colisión con Netlify abajo) */}
      <nav
        aria-label="Navegación principal"
        className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/95 backdrop-blur-md transition-colors duration-300"
      >
        <div className="mx-auto max-w-6xl px-3 sm:px-6">
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-2 sm:gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectView(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors duration-300 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                    isActive
                      ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                      : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <Icon
                    size={17}
                    strokeWidth={isActive ? 2.3 : 1.8}
                    className={
                      isActive
                        ? 'text-[var(--accent-primary)]'
                        : 'text-[var(--text-muted)]'
                    }
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
