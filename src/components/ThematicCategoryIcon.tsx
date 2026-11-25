import {
  Cpu,
  Gamepad2,
  LayoutGrid,
  Newspaper,
  Palette,
  Sparkles,
  Trophy,
} from 'lucide-react';

interface ThematicCategoryIconProps {
  category: string;
  size?: number;
  className?: string;
}

export function ThematicCategoryIcon({
  category,
  size = 14,
  className = '',
}: ThematicCategoryIconProps) {
  const key = category
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (key === 'todo' || key === 'todas' || key === 'todos') {
    return <LayoutGrid size={size} className={className} aria-hidden="true" />;
  }
  if (key.includes('notic') || key.includes('mundo') || key.includes('econom')) {
    return <Newspaper size={size} className={className} aria-hidden="true" />;
  }
  if (key.includes('deport')) {
    return <Trophy size={size} className={className} aria-hidden="true" />;
  }
  if (key.includes('cultur') || key.includes('sociedad')) {
    return <Palette size={size} className={className} aria-hidden="true" />;
  }
  if (key.includes('anime') || key.includes('manga')) {
    return <Sparkles size={size} className={className} aria-hidden="true" />;
  }
  if (key.includes('gaming') || key.includes('arcade')) {
    return <Gamepad2 size={size} className={className} aria-hidden="true" />;
  }
  if (key.includes('tecnolog')) {
    return <Cpu size={size} className={className} aria-hidden="true" />;
  }

  return <LayoutGrid size={size} className={className} aria-hidden="true" />;
}
