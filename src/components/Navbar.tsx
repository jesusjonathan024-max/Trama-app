import { BookOpen, Gamepad2, Newspaper, UserRound, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';

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

const MODE_ICONS = {
  actualidad: Newspaper,
  comunidad: Users,
  biblioteca: BookOpen,
  arcade: Gamepad2,
};

interface NavbarProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  onOpenAuth: () => void;
}

export function Navbar({
  activeView,
  onSelectView,
  onOpenAuth,
}: NavbarProps) {
  const { isAuthenticated, isLoadingSession, user, profile } = useAuth();
  const displayName = profile?.username?.trim() || 'Mi Perfil';

  return (
    <>
      {/* Desktop: barra de navegación principal fija arriba */}
      <header className="hidden md:block sticky top-0 z-40 border-b border-white/[0.08] bg-[#090B0E]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-6">
          {/* Zona 1: Nombre de la app */}
          <button
            type="button"
            onClick={() => onSelectView('actualidad')}
            className="font-display text-xl font-bold tracking-tight text-[#F4F6FA] hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] rounded-md px-1 -ml-1"
          >
            Trama
          </button>

          {/* Zona 2: Selector de Modos con 3 pestañas */}
          <nav
            aria-label="Selector de modos"
            className="flex items-center gap-1 rounded-xl bg-[#12151C] p-1 border border-white/[0.07]"
          >
            {APP_MODES.map((mode) => {
              const isActive = activeView === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onSelectView(mode.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`min-h-[38px] px-4 py-1.5 text-sm font-medium rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] ${
                    isActive
                      ? 'bg-[#1D2330] text-white'
                      : 'text-[#97A1B2] hover:text-[#E5E9F0]'
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </nav>

          {/* Zona 3: Acción de sesión / Mi Perfil */}
          <div className="flex items-center justify-end shrink-0">
            {isLoadingSession ? (
              <div
                aria-label="Verificando sesión"
                className="h-10 w-44 rounded-xl bg-[#141821] animate-pulse"
              />
            ) : isAuthenticated ? (
              <button
                type="button"
                onClick={() => onSelectView('perfil')}
                aria-current={activeView === 'perfil' ? 'page' : undefined}
                className={`min-h-[40px] flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] ${
                  activeView === 'perfil'
                    ? 'bg-[#1D2330] text-white border border-white/[0.12]'
                    : 'bg-[#12151C] text-[#E2E7F0] border border-white/[0.08] hover:border-white/[0.16] hover:bg-[#171B24]'
                }`}
              >
                <Avatar
                  src={profile?.avatar_url}
                  name={profile?.username}
                  email={user?.email}
                  size="sm"
                />
                <span className="max-w-[140px] truncate">{displayName}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="min-h-[40px] rounded-xl bg-[#388BFF] px-4 py-2 text-sm font-semibold text-[#06101F] hover:bg-[#529BFF] active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090B0E]"
              >
                Iniciar sesión / Registrarse
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Móvil: cabecera ligera superior (no fija para mantener la zona táctil libre) */}
      <header className="md:hidden border-b border-white/[0.08] bg-[#090B0E]">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <button
            type="button"
            onClick={() => onSelectView('actualidad')}
            className="font-display text-lg font-bold tracking-tight text-[#F4F6FA] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] rounded-md"
          >
            Trama
          </button>

          {isLoadingSession ? (
            <div
              aria-label="Verificando sesión"
              className="h-9 w-36 rounded-xl bg-[#141821] animate-pulse"
            />
          ) : isAuthenticated ? (
            <button
              type="button"
              onClick={() => onSelectView('perfil')}
              aria-label="Ir a Mi Perfil"
              className={`min-h-[44px] flex items-center gap-2 rounded-xl px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] ${
                activeView === 'perfil'
                  ? 'bg-[#1D2330] text-white'
                  : 'text-[#CBD5E1] hover:text-white'
              }`}
            >
              <Avatar
                src={profile?.avatar_url}
                name={profile?.username}
                email={user?.email}
                size="sm"
              />
              <span className="max-w-[110px] truncate">{displayName}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[40px] rounded-xl bg-[#388BFF] px-3 py-2 text-xs font-semibold text-[#06101F] hover:bg-[#529BFF] active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
            >
              Iniciar sesión / Registrarse
            </button>
          )}
        </div>
      </header>

      {/* Móvil: barra de navegación principal fija abajo (zona natural del pulgar) */}
      <nav
        aria-label="Navegación principal móvil"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0D1016]/95 backdrop-blur-md pb-safe"
      >
        <div
          className={`grid h-16 items-center px-1.5 ${
            isAuthenticated ? 'grid-cols-5' : 'grid-cols-4'
          }`}
        >
          {APP_MODES.map((mode) => {
            const Icon = MODE_ICONS[mode.id];
            const isActive = activeView === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onSelectView(mode.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] ${
                  isActive
                    ? 'text-[#529BFF]'
                    : 'text-[#8B95A5] hover:text-[#E2E7F0]'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
                <span className="text-[10.5px] font-medium tracking-tight whitespace-nowrap">
                  {mode.label}
                </span>
              </button>
            );
          })}

          {isAuthenticated && (
            <button
              type="button"
              onClick={() => onSelectView('perfil')}
              aria-current={activeView === 'perfil' ? 'page' : undefined}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] ${
                activeView === 'perfil'
                  ? 'text-[#529BFF]'
                  : 'text-[#8B95A5] hover:text-[#E2E7F0]'
              }`}
            >
              <UserRound
                size={20}
                strokeWidth={activeView === 'perfil' ? 2.25 : 1.75}
                aria-hidden="true"
              />
              <span className="text-[10.5px] font-medium tracking-tight whitespace-nowrap">
                Perfil
              </span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
