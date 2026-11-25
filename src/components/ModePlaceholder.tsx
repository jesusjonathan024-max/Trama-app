import { BookOpen, Newspaper, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { APP_MODES, type AppMode } from './Navbar';

interface ModePlaceholderProps {
  mode: AppMode;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
}

const MODE_ICONS = {
  actualidad: Newspaper,
  comunidad: Users,
  biblioteca: BookOpen,
};

export function ModePlaceholder({
  mode,
  onOpenAuth,
  onOpenProfile,
}: ModePlaceholderProps) {
  const { isAuthenticated, isLoadingSession } = useAuth();
  const currentMode = APP_MODES.find((item) => item.id === mode) ?? APP_MODES[0];
  const Icon = MODE_ICONS[currentMode.id];

  return (
    <section
      aria-labelledby="mode-heading"
      className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-3xl flex-col items-center justify-center px-5 py-16 text-center md:min-h-[calc(100dvh-5rem)] md:px-8"
    >
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#131720] border border-white/[0.08] text-[#7FB2FF]">
        <Icon size={26} strokeWidth={1.75} aria-hidden="true" />
      </div>

      <h1
        id="mode-heading"
        className="text-balance font-display text-3xl font-bold tracking-tight text-[#F5F7FB] sm:text-4xl"
      >
        Próximamente: {currentMode.label}
      </h1>

      <p className="mt-4 max-w-md text-base leading-relaxed text-[#97A1B2]">
        {currentMode.description}
      </p>

      {!isLoadingSession && (
        <div className="mt-8">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={onOpenProfile}
              className="min-h-[44px] rounded-xl border border-white/[0.12] bg-[#131720] px-5 py-2.5 text-sm font-medium text-[#E5E9F0] hover:border-white/[0.2] hover:bg-[#191E2A] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
            >
              Ir a Mi Perfil
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[44px] rounded-xl border border-white/[0.12] bg-[#131720] px-5 py-2.5 text-sm font-medium text-[#E5E9F0] hover:border-white/[0.2] hover:bg-[#191E2A] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
            >
              Iniciar sesión / Registrarse
            </button>
          )}
        </div>
      )}
    </section>
  );
}
