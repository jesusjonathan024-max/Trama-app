import { useId } from 'react';
import {
  getCategoryVisualTheme,
  type CategoryMotif,
} from '../lib/categoryColors';

interface CategoryCoverArtworkProps {
  category?: string | null;
  title?: string | null;
  fallbackMode?: 'actualidad' | 'comunidad' | 'novela' | 'manhwa' | 'arcade';
  variant?: 'hero' | 'card' | 'portrait' | 'compact';
  className?: string;
}

function MotifGeometry({
  motif,
  accentHex,
  secondaryHex,
}: {
  motif: CategoryMotif;
  accentHex: string;
  secondaryHex: string;
}) {
  switch (motif) {
    case 'manga':
      return (
        <g>
          {/* Paneles cinéticos y prisma estelar para Manga/Manhwa */}
          <polygon
            points="280,25 460,-20 510,165 320,210"
            fill="#FFFFFF"
            fillOpacity="0.08"
          />
          <polygon
            points="35,175 185,120 225,265 45,295"
            fill="#0F1115"
            fillOpacity="0.22"
          />
          <g stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="1.4">
            <line x1="255" y1="0" x2="365" y2="270" />
            <line x1="280" y1="0" x2="395" y2="270" />
            <line x1="230" y1="0" x2="335" y2="270" />
          </g>
          <path
            d="M365 72 L374 96 L398 105 L374 114 L365 138 L356 114 L332 105 L356 96 Z"
            fill="#FFFFFF"
            fillOpacity="0.88"
          />
          <circle
            cx="365"
            cy="105"
            r="52"
            stroke={secondaryHex}
            strokeWidth="1.8"
            strokeDasharray="6 6"
            strokeOpacity="0.7"
          />
          <circle
            cx="120"
            cy="88"
            r="34"
            stroke="#FFFFFF"
            strokeOpacity="0.2"
            strokeWidth="1.5"
          />
        </g>
      );

    case 'novela':
      return (
        <g>
          {/* Arcos celestiales y páginas abiertas estilizadas para Novelas */}
          <circle
            cx="370"
            cy="95"
            r="78"
            fill={accentHex}
            fillOpacity="0.18"
          />
          <circle
            cx="370"
            cy="95"
            r="56"
            stroke="#FFFFFF"
            strokeOpacity="0.28"
            strokeWidth="1.5"
          />
          <path
            d="M332 108 C348 96 360 98 370 107 C380 98 392 96 408 108 V142 C392 133 380 135 370 144 C360 135 348 133 332 142 Z"
            fill="#FFFFFF"
            fillOpacity="0.16"
            stroke="#FFFFFF"
            strokeOpacity="0.72"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line
            x1="370"
            y1="107"
            x2="370"
            y2="144"
            stroke="#FFFFFF"
            strokeOpacity="0.72"
            strokeWidth="1.8"
          />
          <path
            d="M40 215 Q165 135 290 190 T495 140"
            stroke={secondaryHex}
            strokeOpacity="0.45"
            strokeWidth="2"
            fill="none"
          />
          <circle cx="115" cy="70" r="3" fill="#FFFFFF" fillOpacity="0.75" />
          <circle cx="155" cy="52" r="2" fill="#FFFFFF" fillOpacity="0.55" />
          <circle cx="240" cy="86" r="2.5" fill="#FFFFFF" fillOpacity="0.65" />
        </g>
      );

    case 'deportes':
      return (
        <g>
          {/* Pistas orbitales y diagonales de velocidad para Deportes */}
          <path
            d="M-20 220 L190 40 L255 40 L45 220 Z"
            fill="#FFFFFF"
            fillOpacity="0.1"
          />
          <path
            d="M110 260 L320 60 L365 60 L155 260 Z"
            fill="#FFFFFF"
            fillOpacity="0.08"
          />
          <circle
            cx="370"
            cy="115"
            r="64"
            stroke="#FFFFFF"
            strokeOpacity="0.28"
            strokeWidth="2.5"
          />
          <circle
            cx="370"
            cy="115"
            r="42"
            stroke={accentHex}
            strokeOpacity="0.75"
            strokeWidth="2"
            strokeDasharray="10 6"
          />
          <path
            d="M320 115 C345 88 395 88 420 115"
            stroke="#FFFFFF"
            strokeOpacity="0.6"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M320 115 C345 142 395 142 420 115"
            stroke="#FFFFFF"
            strokeOpacity="0.35"
            strokeWidth="1.5"
            fill="none"
          />
        </g>
      );

    case 'cultura':
      return (
        <g>
          {/* Arcos arquitectónicos y anillos culturales para Cultura / Sociedad */}
          <rect
            x="300"
            y="40"
            width="130"
            height="175"
            rx="65"
            fill="#FFFFFF"
            fillOpacity="0.1"
            stroke="#FFFFFF"
            strokeOpacity="0.32"
            strokeWidth="1.8"
          />
          <rect
            x="325"
            y="65"
            width="80"
            height="125"
            rx="40"
            stroke={secondaryHex}
            strokeOpacity="0.65"
            strokeWidth="1.6"
          />
          <circle cx="365" cy="112" r="18" fill="#FFFFFF" fillOpacity="0.82" />
          <path
            d="M25 190 C95 140 165 215 245 160 C310 115 390 145 480 100"
            stroke="#FFFFFF"
            strokeOpacity="0.3"
            strokeWidth="2"
            fill="none"
          />
        </g>
      );

    case 'tecnologia':
      return (
        <g>
          {/* Red geométrica y nodos luminosos para Tecnología */}
          <g stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="1.2">
            <path d="M270 50 H360 L395 85 H465" fill="none" />
            <path d="M290 120 H345 L380 155 H460" fill="none" />
            <path d="M360 50 V120" />
            <path d="M395 85 V185" />
          </g>
          <polygon
            points="365,65 405,88 405,134 365,157 325,134 325,88"
            fill="#FFFFFF"
            fillOpacity="0.1"
            stroke={accentHex}
            strokeOpacity="0.8"
            strokeWidth="2"
          />
          <circle cx="365" cy="111" r="12" fill="#FFFFFF" fillOpacity="0.85" />
          <circle cx="270" cy="50" r="4" fill={secondaryHex} />
          <circle cx="465" cy="85" r="4" fill="#FFFFFF" />
          <circle cx="395" cy="185" r="4" fill={accentHex} />
        </g>
      );

    case 'economia':
      return (
        <g>
          {/* Barras armónicas ascendentes y curva editorial para Economía */}
          <g fill="#FFFFFF" fillOpacity="0.16">
            <rect x="290" y="145" width="22" height="65" rx="6" />
            <rect x="324" y="118" width="22" height="92" rx="6" />
            <rect x="358" y="92" width="22" height="118" rx="6" />
            <rect x="392" y="62" width="22" height="148" rx="6" fillOpacity="0.26" />
          </g>
          <path
            d="M275 148 L335 112 L370 124 L426 54"
            stroke="#FFFFFF"
            strokeOpacity="0.82"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="426" cy="54" r="5" fill="#FFFFFF" />
        </g>
      );

    case 'debate':
      return (
        <g>
          {/* Burbujas orbitales entrelazadas para Comunidad / Debate */}
          <rect
            x="296"
            y="58"
            width="126"
            height="76"
            rx="22"
            fill="#FFFFFF"
            fillOpacity="0.14"
            stroke="#FFFFFF"
            strokeOpacity="0.55"
            strokeWidth="1.8"
          />
          <rect
            x="332"
            y="112"
            width="112"
            height="64"
            rx="20"
            fill={accentHex}
            fillOpacity="0.24"
            stroke={secondaryHex}
            strokeOpacity="0.8"
            strokeWidth="1.8"
          />
          <line
            x1="320"
            y1="86"
            x2="394"
            y2="86"
            stroke="#FFFFFF"
            strokeOpacity="0.7"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="320"
            y1="102"
            x2="372"
            y2="102"
            stroke="#FFFFFF"
            strokeOpacity="0.45"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      );

    case 'arcade':
      return (
        <g>
          {/* Retícula neón y rombos de Arcade */}
          <polygon
            points="365,45 430,110 365,175 300,110"
            fill="#FFFFFF"
            fillOpacity="0.12"
            stroke="#FFFFFF"
            strokeOpacity="0.65"
            strokeWidth="2"
          />
          <polygon
            points="365,72 403,110 365,148 327,110"
            fill={accentHex}
            fillOpacity="0.3"
            stroke={secondaryHex}
            strokeWidth="1.8"
          />
          <circle cx="365" cy="110" r="10" fill="#FFFFFF" fillOpacity="0.9" />
        </g>
      );

    case 'actualidad':
    default:
      return (
        <g>
          {/* Meridianos globales y ondas informativas para Actualidad / Mundo */}
          <circle
            cx="370"
            cy="115"
            r="68"
            fill="#FFFFFF"
            fillOpacity="0.1"
            stroke="#FFFFFF"
            strokeOpacity="0.55"
            strokeWidth="1.8"
          />
          <ellipse
            cx="370"
            cy="115"
            rx="34"
            ry="68"
            stroke="#FFFFFF"
            strokeOpacity="0.4"
            strokeWidth="1.5"
            fill="none"
          />
          <ellipse
            cx="370"
            cy="115"
            rx="68"
            ry="24"
            stroke={secondaryHex}
            strokeOpacity="0.6"
            strokeWidth="1.5"
            fill="none"
          />
          <line
            x1="302"
            y1="115"
            x2="438"
            y2="115"
            stroke="#FFFFFF"
            strokeOpacity="0.35"
            strokeWidth="1.4"
          />
          <circle cx="370" cy="115" r="88" stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="1.2" strokeDasharray="4 6" />
        </g>
      );
  }
}

export function CategoryCoverArtwork({
  category,
  title,
  fallbackMode,
  variant = 'card',
  className = '',
}: CategoryCoverArtworkProps) {
  const uid = useId().replace(/:/g, '');
  const gradId = `cat-grad-${uid}`;
  const orbId = `cat-orb-${uid}`;
  const gridId = `cat-grid-${uid}`;
  const theme = getCategoryVisualTheme(category, fallbackMode);

  const displayCategory = (
    category?.trim() ||
    (fallbackMode === 'manhwa'
      ? 'Manhwa'
      : fallbackMode === 'novela'
        ? 'Novela'
        : fallbackMode === 'comunidad'
          ? 'Comunidad'
          : 'Actualidad')
  );

  const isPortrait = variant === 'portrait';
  const isCompact = variant === 'compact';

  return (
    <div
      role="img"
      aria-label={title ? `Portada ilustrada de ${title}` : `Ilustración de ${displayCategory}`}
      className={`relative overflow-hidden select-none ${className}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${theme.gradientFrom} 0%, ${theme.gradientVia} 52%, ${theme.gradientTo} 100%)`,
      }}
    >
      <svg
        viewBox={isPortrait ? '0 0 360 480' : '0 0 480 240'}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={theme.gradientFrom} />
            <stop offset="52%" stopColor={theme.gradientVia} />
            <stop offset="100%" stopColor={theme.gradientTo} />
          </linearGradient>

          <radialGradient id={orbId} cx="78%" cy="24%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28" />
            <stop offset="50%" stopColor={theme.accentHex} stopOpacity="0.14" />
            <stop offset="100%" stopColor="#0F1115" stopOpacity="0.32" />
          </radialGradient>

          <pattern
            id={gridId}
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 28 0 L 0 0 0 28"
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity="0.07"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <rect
          width={isPortrait ? 360 : 480}
          height={isPortrait ? 480 : 240}
          fill={`url(#${gradId})`}
        />
        <rect
          width={isPortrait ? 360 : 480}
          height={isPortrait ? 480 : 240}
          fill={`url(#${gridId})`}
        />
        <rect
          width={isPortrait ? 360 : 480}
          height={isPortrait ? 480 : 240}
          fill={`url(#${orbId})`}
        />

        <g
          transform={
            isPortrait
              ? 'translate(-125, 42) scale(0.95)'
              : isCompact
                ? 'translate(25, -18) scale(0.95)'
                : undefined
          }
        >
          <MotifGeometry
            motif={theme.id}
            accentHex={theme.accentHex}
            secondaryHex={theme.secondaryHex}
          />
        </g>
      </svg>

      {/* Scrim inferior medido para alto contraste del texto */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/72 via-black/15 to-transparent"
      />

      {/* Sello editorial discreto en portada automática */}
      <div
        className={`relative z-10 flex h-full w-full flex-col justify-end ${
          isPortrait ? 'p-4 pb-11' : isCompact ? 'p-3.5' : 'p-5 sm:p-6'
        }`}
      >
        <span className="inline-flex w-fit items-center rounded-md bg-black/35 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-white/95 backdrop-blur-sm border border-white/15">
          {displayCategory}
        </span>

        {title && !isPortrait && (
          <p
            className={`mt-1.5 font-display font-bold leading-snug text-white drop-shadow-sm line-clamp-2 ${
              variant === 'hero'
                ? 'text-lg sm:text-2xl max-w-md'
                : isCompact
                  ? 'text-sm max-w-md'
                  : 'text-base sm:text-lg max-w-sm'
            }`}
          >
            {title}
          </p>
        )}
      </div>
    </div>
  );
}
