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
      {/* Encabezado principal superior: marca "Trama" y acceso a perfil / sesión */}
      <header className="border-b border-white/[0.06] bg-[#090B0E]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
          <button
            type="button"
            onClick={() => onSelectView('actualidad')}
            className="font-display text-xl font-bold tracking-tight text-[#F4F6FA] hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] rounded-md px-1 -ml-1"
          >
            Trama
          </button>

          <div className="flex items-center justify-end shrink-0">
            {isLoadingSession ? (
              <div
                aria-label="Verificando sesión"
                className="h-9 w-36 sm:h-10 sm:w-44 rounded-xl bg-[#141821] animate-pulse"
              />
            ) : isAuthenticated ? (
              <button
                type="button"
                onClick={() => onSelectView('perfil')}
                aria-current={activeView === 'perfil' ? 'page' : undefined}
                className={`min-h-[42px] flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] ${
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
                <span className="max-w-[120px] sm:max-w-[160px] truncate">
                  {displayName}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="min-h-[40px] rounded-xl bg-[#388BFF] px-3.5 py-2 text-xs sm:px-4 sm:text-sm font-semibold text-[#06101F] hover:bg-[#529BFF] active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090B0E]"
              >
                Iniciar sesión / Registrarse
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Barra horizontal superior fija con las 5 secciones (con deslizamiento lateral suave en móvil) */}
      <nav
        aria-label="Navegación principal"
        className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#090B0E]/95 backdrop-blur-md"
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
                  className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] ${
                    isActive
                      ? 'border-white/[0.14] bg-[#1C2332] text-white'
                      : 'border-transparent text-[#95A0B3] hover:bg-white/[0.04] hover:text-[#E5E9F0]'
                  }`}
                >
                  <Icon
                    size={17}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    className={isActive ? 'text-[#529BFF]' : 'text-[#7F8A9E]'}
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
