export type CategoryMotif =
  | 'manga'
  | 'novela'
  | 'deportes'
  | 'cultura'
  | 'actualidad'
  | 'tecnologia'
  | 'economia'
  | 'debate'
  | 'arcade';

export interface CategoryVisualTheme {
  id: CategoryMotif;
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  accentHex: string;
  secondaryHex: string;
  /** Etiqueta de categoría con color vivo y alto contraste en Light y Dark */
  labelClass: string;
  /** Clase de texto acentuado limpio (sin cápsula) */
  textClass: string;
}

const THEMES: Record<CategoryMotif, CategoryVisualTheme> = {
  manga: {
    id: 'manga',
    gradientFrom: '#7C3AED',
    gradientVia: '#C026D3',
    gradientTo: '#EC4899',
    accentHex: '#EC4899',
    secondaryHex: '#A78BFA',
    labelClass:
      'bg-fuchsia-600/14 text-fuchsia-700 border-fuchsia-500/35 dark:bg-fuchsia-500/20 dark:text-fuchsia-200 dark:border-fuchsia-400/40',
    textClass: 'text-fuchsia-700 dark:text-fuchsia-300',
  },
  novela: {
    id: 'novela',
    gradientFrom: '#4338CA',
    gradientVia: '#6D28D9',
    gradientTo: '#8B5CF6',
    accentHex: '#818CF8',
    secondaryHex: '#C4B5FD',
    labelClass:
      'bg-violet-600/14 text-violet-700 border-violet-500/35 dark:bg-violet-500/20 dark:text-violet-200 dark:border-violet-400/40',
    textClass: 'text-violet-700 dark:text-violet-300',
  },
  deportes: {
    id: 'deportes',
    gradientFrom: '#EA580C',
    gradientVia: '#F97316',
    gradientTo: '#F59E0B',
    accentHex: '#FBBF24',
    secondaryHex: '#FB923C',
    labelClass:
      'bg-orange-600/14 text-orange-700 border-orange-500/35 dark:bg-orange-500/20 dark:text-orange-200 dark:border-orange-400/40',
    textClass: 'text-orange-700 dark:text-orange-300',
  },
  cultura: {
    id: 'cultura',
    gradientFrom: '#0891B2',
    gradientVia: '#0D9488',
    gradientTo: '#14B8A6',
    accentHex: '#2DD4BF',
    secondaryHex: '#22D3EE',
    labelClass:
      'bg-teal-600/14 text-teal-700 border-teal-500/35 dark:bg-teal-500/20 dark:text-teal-200 dark:border-teal-400/40',
    textClass: 'text-teal-700 dark:text-teal-300',
  },
  actualidad: {
    id: 'actualidad',
    gradientFrom: '#0369A1',
    gradientVia: '#0284C7',
    gradientTo: '#06B6D4',
    accentHex: '#38BDF8',
    secondaryHex: '#22D3EE',
    labelClass:
      'bg-cyan-600/14 text-cyan-700 border-cyan-500/35 dark:bg-cyan-500/20 dark:text-cyan-200 dark:border-cyan-400/40',
    textClass: 'text-cyan-700 dark:text-cyan-300',
  },
  tecnologia: {
    id: 'tecnologia',
    gradientFrom: '#1D4ED8',
    gradientVia: '#0284C7',
    gradientTo: '#06B6D4',
    accentHex: '#22D3EE',
    secondaryHex: '#60A5FA',
    labelClass:
      'bg-sky-600/14 text-sky-700 border-sky-500/35 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-400/40',
    textClass: 'text-sky-700 dark:text-sky-300',
  },
  economia: {
    id: 'economia',
    gradientFrom: '#047857',
    gradientVia: '#059669',
    gradientTo: '#0D9488',
    accentHex: '#34D399',
    secondaryHex: '#2DD4BF',
    labelClass:
      'bg-emerald-600/14 text-emerald-700 border-emerald-500/35 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40',
    textClass: 'text-emerald-700 dark:text-emerald-300',
  },
  debate: {
    id: 'debate',
    gradientFrom: '#059669',
    gradientVia: '#0D9488',
    gradientTo: '#06B6D4',
    accentHex: '#34D399',
    secondaryHex: '#22D3EE',
    labelClass:
      'bg-emerald-600/14 text-emerald-700 border-emerald-500/35 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/40',
    textClass: 'text-emerald-700 dark:text-emerald-300',
  },
  arcade: {
    id: 'arcade',
    gradientFrom: '#EA580C',
    gradientVia: '#F97316',
    gradientTo: '#F43F5E',
    accentHex: '#FB7185',
    secondaryHex: '#FDBA74',
    labelClass:
      'bg-rose-600/14 text-rose-700 border-rose-500/35 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/40',
    textClass: 'text-orange-700 dark:text-orange-300',
  },
};

export function getCategoryVisualTheme(
  category?: string | null,
  fallbackMode?: 'actualidad' | 'comunidad' | 'novela' | 'manhwa' | 'arcade'
): CategoryVisualTheme {
  const norm = (category ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (
    norm.includes('manhwa') ||
    norm.includes('manga') ||
    norm.includes('anime') ||
    norm.includes('webtoon') ||
    norm.includes('comic')
  ) {
    return THEMES.manga;
  }
  if (
    norm.includes('novela') ||
    norm.includes('fantasia') ||
    norm.includes('literatura') ||
    norm.includes('ficcion') ||
    norm.includes('romance')
  ) {
    return THEMES.novela;
  }
  if (
    norm.includes('deport') ||
    norm.includes('futbol') ||
    norm.includes('basket') ||
    norm.includes('atlet') ||
    norm.includes('esport')
  ) {
    return THEMES.deportes;
  }
  if (
    norm.includes('cultur') ||
    norm.includes('sociedad') ||
    norm.includes('arte') ||
    norm.includes('cine') ||
    norm.includes('musica')
  ) {
    return THEMES.cultura;
  }
  if (
    norm.includes('tecnolog') ||
    norm.includes('ciencia') ||
    norm.includes('ia') ||
    norm.includes('software')
  ) {
    return THEMES.tecnologia;
  }
  if (norm.includes('econom') || norm.includes('finanz') || norm.includes('negoc')) {
    return THEMES.economia;
  }
  if (norm.includes('gaming') || norm.includes('arcade') || norm.includes('juego')) {
    return THEMES.arcade;
  }
  if (norm.includes('debate') || norm.includes('comunidad')) {
    return THEMES.debate;
  }
  if (norm.includes('off-topic') || norm.includes('off topic')) {
    return THEMES.manga;
  }
  if (norm.includes('mundo') || norm.includes('actualidad') || norm.includes('notic')) {
    return THEMES.actualidad;
  }

  if (fallbackMode === 'manhwa') return THEMES.manga;
  if (fallbackMode === 'novela') return THEMES.novela;
  if (fallbackMode === 'comunidad') return THEMES.debate;
  if (fallbackMode === 'arcade') return THEMES.arcade;
  return THEMES.actualidad;
}

const HASHTAG_TONES = [
  {
    inline: 'text-cyan-600 dark:text-cyan-300 hover:text-cyan-500 dark:hover:text-cyan-200',
    chipIdle:
      'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 hover:bg-cyan-500/18 dark:border-cyan-400/30 dark:bg-cyan-500/12 dark:text-cyan-300',
    chipActive:
      'border-cyan-500 bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-sm',
  },
  {
    inline:
      'text-emerald-600 dark:text-emerald-300 hover:text-emerald-500 dark:hover:text-emerald-200',
    chipIdle:
      'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/18 dark:border-emerald-400/30 dark:bg-emerald-500/12 dark:text-emerald-300',
    chipActive:
      'border-emerald-500 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm',
  },
  {
    inline:
      'text-violet-600 dark:text-violet-300 hover:text-violet-500 dark:hover:text-violet-200',
    chipIdle:
      'border-violet-500/30 bg-violet-500/10 text-violet-700 hover:bg-violet-500/18 dark:border-violet-400/30 dark:bg-violet-500/12 dark:text-violet-300',
    chipActive:
      'border-violet-500 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-sm',
  },
  {
    inline:
      'text-orange-600 dark:text-orange-300 hover:text-orange-500 dark:hover:text-orange-200',
    chipIdle:
      'border-orange-500/30 bg-orange-500/10 text-orange-700 hover:bg-orange-500/18 dark:border-orange-400/30 dark:bg-orange-500/12 dark:text-orange-300',
    chipActive:
      'border-orange-500 bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-sm',
  },
  {
    inline:
      'text-fuchsia-600 dark:text-fuchsia-300 hover:text-fuchsia-500 dark:hover:text-fuchsia-200',
    chipIdle:
      'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-700 hover:bg-fuchsia-500/18 dark:border-fuchsia-400/30 dark:bg-fuchsia-500/12 dark:text-fuchsia-300',
    chipActive:
      'border-fuchsia-500 bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white shadow-sm',
  },
] as const;

export function getHashtagTone(tag: string) {
  let hash = 0;
  const cleaned = tag.trim().toLowerCase();
  for (let i = 0; i < cleaned.length; i += 1) {
    hash = (hash * 31 + cleaned.charCodeAt(i)) >>> 0;
  }
  return HASHTAG_TONES[hash % HASHTAG_TONES.length];
}
