import { useState } from 'react';
import { RotateCcw, ShieldCheck } from 'lucide-react';

interface SandboxedGameFrameProps {
  title: string;
  htmlCode: string;
  className?: string;
  showHeader?: boolean;
}

/**
 * Contenedor estricto de aislamiento Sandbox para juegos creados por la comunidad.
 * SEGURIDAD CRÍTICA:
 * - Usa exclusivamente sandbox="allow-scripts" (NUNCA allow-same-origin ni allow-top-navigation).
 * - El origen del iframe es opaco (null), impidiendo acceso a cookies, localStorage,
 *   sessionStorage, tokens JWT de Supabase o navegación de la ventana principal.
 */
export function SandboxedGameFrame({
  title,
  htmlCode,
  className = 'h-[480px] w-full',
  showHeader = true,
}: SandboxedGameFrameProps) {
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[#090B12]">
      {showHeader && (
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] bg-[#0D111C] px-3.5 py-2 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 min-w-0">
            <ShieldCheck size={14} className="shrink-0" aria-hidden="true" />
            <span className="truncate font-medium">
              Entorno aislado (Sandbox seguro)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-[#D5DCE6] hover:bg-white/[0.1] transition-colors shrink-0"
          >
            <RotateCcw size={12} aria-hidden="true" />
            <span>Reiniciar</span>
          </button>
        </div>
      )}

      <iframe
        key={reloadKey}
        title={title}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        srcDoc={htmlCode}
        className={`block border-0 bg-[#090B12] ${className}`}
      />
    </div>
  );
}
