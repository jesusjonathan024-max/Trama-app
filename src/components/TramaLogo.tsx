import { useId } from 'react';

interface TramaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

const ICON_SIZES: Record<NonNullable<TramaLogoProps['size']>, string> = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9 sm:h-10 sm:w-10',
  lg: 'h-12 w-12 sm:h-14 sm:w-14',
};

const WORDMARK_SIZES: Record<NonNullable<TramaLogoProps['size']>, string> = {
  sm: 'text-base',
  md: 'text-lg sm:text-xl',
  lg: 'text-2xl sm:text-3xl',
};

export function TramaLogo({
  size = 'md',
  showWordmark = true,
  className = '',
}: TramaLogoProps) {
  const uid = useId().replace(/:/g, '');
  const glowId = `trama-glow-${uid}`;
  const qTlId = `trama-q-tl-${uid}`;
  const qTrId = `trama-q-tr-${uid}`;
  const qBlId = `trama-q-bl-${uid}`;
  const qBrId = `trama-q-br-${uid}`;
  const gTlId = `trama-g-tl-${uid}`;
  const gTrId = `trama-g-tr-${uid}`;
  const gBlId = `trama-g-bl-${uid}`;
  const gBrId = `trama-g-br-${uid}`;

  return (
    <span
      className={`group inline-flex items-center gap-2.5 select-none whitespace-nowrap shrink-0 ${className}`}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className={`${ICON_SIZES[size]} shrink-0 rounded-[11px] shadow-md transition-transform duration-300 ease-out group-hover:scale-105`}
      >
        <defs>
          <filter id={glowId} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="1.7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <clipPath id={qTlId}>
            <rect x="0" y="0" width="32" height="32" />
          </clipPath>
          <clipPath id={qTrId}>
            <rect x="32" y="0" width="32" height="32" />
          </clipPath>
          <clipPath id={qBlId}>
            <rect x="0" y="32" width="32" height="32" />
          </clipPath>
          <clipPath id={qBrId}>
            <rect x="32" y="32" width="32" height="32" />
          </clipPath>

          <linearGradient
            id={gTlId}
            x1="6"
            y1="6"
            x2="32"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient
            id={gTrId}
            x1="32"
            y1="6"
            x2="58"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <linearGradient
            id={gBlId}
            x1="6"
            y1="32"
            x2="32"
            y2="58"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient
            id={gBrId}
            x1="32"
            y1="32"
            x2="58"
            y2="58"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FB923C" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
        </defs>

        {/* Base oscura oficial #0F1115 */}
        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="15"
          fill="#0F1115"
          stroke="#222836"
          strokeWidth="1.4"
        />

        {/* Dos bucles orbitales entrelazados en marco redondeado de 4 cuadrantes */}
        <g filter={`url(#${glowId})`}>
          {/* Superior izquierdo: Cian Eléctrico (#06B6D4) */}
          <g clipPath={`url(#${qTlId})`}>
            <rect
              x="8.5"
              y="8.5"
              width="47"
              height="47"
              rx="16.5"
              stroke={`url(#${gTlId})`}
              strokeWidth="2.4"
            />
            <ellipse
              cx="32"
              cy="32"
              rx="23.5"
              ry="12.2"
              transform="rotate(-38 32 32)"
              stroke="#06B6D4"
              strokeWidth="2.2"
              strokeOpacity="0.92"
            />
            <ellipse
              cx="32"
              cy="32"
              rx="23.5"
              ry="12.2"
              transform="rotate(38 32 32)"
              stroke="#22D3EE"
              strokeWidth="1.8"
              strokeOpacity="0.72"
            />
          </g>

          {/* Superior derecho: Verde Esmeralda (#10B981) */}
          <g clipPath={`url(#${qTrId})`}>
            <rect
              x="8.5"
              y="8.5"
              width="47"
              height="47"
              rx="16.5"
              stroke={`url(#${gTrId})`}
              strokeWidth="2.4"
            />
            <ellipse
              cx="32"
              cy="32"
              rx="23.5"
              ry="12.2"
              transform="rotate(-38 32 32)"
              stroke="#34D399"
              strokeWidth="1.8"
              strokeOpacity="0.72"
            />
            <ellipse
              cx="32"
              cy="32"
              rx="23.5"
              ry="12.2"
              transform="rotate(38 32 32)"
              stroke="#10B981"
              strokeWidth="2.2"
              strokeOpacity="0.92"
            />
          </g>

          {/* Inferior izquierdo: Violeta Neón (#8B5CF6) */}
          <g clipPath={`url(#${qBlId})`}>
            <rect
              x="8.5"
              y="8.5"
              width="47"
              height="47"
              rx="16.5"
              stroke={`url(#${gBlId})`}
              strokeWidth="2.4"
            />
            <ellipse
              cx="32"
              cy="32"
              rx="23.5"
              ry="12.2"
              transform="rotate(-38 32 32)"
              stroke="#A78BFA"
              strokeWidth="1.8"
              strokeOpacity="0.72"
            />
            <ellipse
              cx="32"
              cy="32"
              rx="23.5"
              ry="12.2"
              transform="rotate(38 32 32)"
              stroke="#8B5CF6"
              strokeWidth="2.2"
              strokeOpacity="0.92"
            />
          </g>

          {/* Inferior derecho: Naranja Coral (#F97316) */}
          <g clipPath={`url(#${qBrId})`}>
            <rect
              x="8.5"
              y="8.5"
              width="47"
              height="47"
              rx="16.5"
              stroke={`url(#${gBrId})`}
              strokeWidth="2.4"
            />
            <ellipse
              cx="32"
              cy="32"
              rx="23.5"
              ry="12.2"
              transform="rotate(-38 32 32)"
              stroke="#F97316"
              strokeWidth="2.2"
              strokeOpacity="0.92"
            />
            <ellipse
              cx="32"
              cy="32"
              rx="23.5"
              ry="12.2"
              transform="rotate(38 32 32)"
              stroke="#FB923C"
              strokeWidth="1.8"
              strokeOpacity="0.72"
            />
          </g>
        </g>

        {/* Micro-ícono Superior Izquierdo: Libro abierto (Lectura y Biblioteca) */}
        <g transform="translate(14.5 14.5)">
          <circle
            cx="0"
            cy="0"
            r="6.2"
            fill="#0F1115"
            stroke="#06B6D4"
            strokeWidth="1.2"
          />
          <path
            d="M-3.5 -1.8 C-2.2 -2.4 -0.9 -2.2 0 -1.3 C0.9 -2.2 2.2 -2.4 3.5 -1.8 L3.5 2.1 C2.2 1.6 0.9 1.7 0 2.5 C-0.9 1.7 -2.2 1.6 -3.5 2.1 Z"
            stroke="#22D3EE"
            strokeWidth="1.15"
            strokeLinejoin="round"
            fill="none"
          />
          <line
            x1="0"
            y1="-1.3"
            x2="0"
            y2="2.4"
            stroke="#22D3EE"
            strokeWidth="1"
          />
        </g>

        {/* Micro-ícono Superior Derecho: Globo terráqueo (Actualidad, Deportes y Cultura) */}
        <g transform="translate(49.5 14.5)">
          <circle
            cx="0"
            cy="0"
            r="6.2"
            fill="#0F1115"
            stroke="#10B981"
            strokeWidth="1.2"
          />
          <circle cx="0" cy="0" r="3.4" stroke="#34D399" strokeWidth="1.1" />
          <ellipse
            cx="0"
            cy="0"
            rx="1.6"
            ry="3.4"
            stroke="#34D399"
            strokeWidth="0.95"
          />
          <line
            x1="-3.3"
            y1="0"
            x2="3.3"
            y2="0"
            stroke="#34D399"
            strokeWidth="0.95"
          />
        </g>

        {/* Micro-ícono Inferior Izquierdo: Burbuja de diálogo (Comunidad) */}
        <g transform="translate(14.5 49.5)">
          <circle
            cx="0"
            cy="0"
            r="6.2"
            fill="#0F1115"
            stroke="#8B5CF6"
            strokeWidth="1.2"
          />
          <path
            d="M-3.3 -2.2 H3.3 A0.9 0.9 0 0 1 4.2 -1.3 V1.5 A0.9 0.9 0 0 1 3.3 2.4 H-0.4 L-2.4 3.8 L-2 2.4 H-3.3 A0.9 0.9 0 0 1 -4.2 1.5 V-1.3 A0.9 0.9 0 0 1 -3.3 -2.2 Z"
            stroke="#A78BFA"
            strokeWidth="1.1"
            strokeLinejoin="round"
            fill="none"
          />
        </g>

        {/* Micro-ícono Inferior Derecho: Control de videojuegos (Arcade) */}
        <g transform="translate(49.5 49.5)">
          <circle
            cx="0"
            cy="0"
            r="6.2"
            fill="#0F1115"
            stroke="#F97316"
            strokeWidth="1.2"
          />
          <path
            d="M-3.5 -1.4 H3.5 C4.1 -1.4 4.4 -0.9 4.2 0.3 L3.8 2.1 C3.6 2.6 3.1 2.7 2.6 2.2 L1.7 1.3 H-1.7 L-2.6 2.2 C-3.1 2.7 -3.6 2.6 -3.8 2.1 L-4.2 0.3 C-4.4 -0.9 -4.1 -1.4 -3.5 -1.4 Z"
            stroke="#FB923C"
            strokeWidth="1.05"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M-2.2 -0.2 H-1 M-1.6 -0.8 V0.4"
            stroke="#FDBA74"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
          <circle cx="1.6" cy="-0.4" r="0.55" fill="#FDBA74" />
          <circle cx="2.5" cy="0.3" r="0.55" fill="#FDBA74" />
        </g>

        {/* Halo oscuro central para separación óptica de la "T" */}
        <circle cx="32" cy="32" r="13.5" fill="#0F1115" fillOpacity="0.92" />

        {/* Letra "T" geométrica blanca con corte dinámico en la base */}
        <path
          d="M19.5 20.5 H44.5 L42.3 26.2 H35.4 V42.2 L28.6 46.2 V26.2 H21.7 Z"
          fill="#FFFFFF"
        />
      </svg>

      {showWordmark && (
        <span
          className={`font-display font-extrabold tracking-wider text-[#0F172A] dark:text-white transition-colors duration-300 ${WORDMARK_SIZES[size]}`}
        >
          TRAMA
        </span>
      )}
    </span>
  );
}
