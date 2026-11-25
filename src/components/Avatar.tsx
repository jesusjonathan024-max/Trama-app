import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { isSafeHttpUrl } from '../lib/supabase';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-24 w-24 text-2xl',
};

const ICON_SIZES: Record<NonNullable<AvatarProps['size']>, number> = {
  sm: 14,
  md: 18,
  lg: 34,
};

function getInitials(name?: string | null, email?: string | null): string | null {
  const source = name?.trim() || email?.split('@')[0]?.trim();
  if (!source) return null;
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function Avatar({
  src,
  name,
  email,
  size = 'md',
  className = '',
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const validUrl = isSafeHttpUrl(src) && !hasError ? src! : null;
  const initials = getInitials(name, email);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-[#191E28] border border-white/[0.1] flex items-center justify-center font-semibold text-[#CBD5E1] select-none ${SIZE_CLASSES[size]} ${className}`}
    >
      {validUrl ? (
        <img
          src={validUrl}
          alt={name ? `Foto de perfil de ${name}` : 'Foto de perfil del usuario'}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className="h-full w-full object-cover"
        />
      ) : initials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <User size={ICON_SIZES[size]} className="text-[#8B95A5]" aria-hidden="true" />
      )}
    </div>
  );
}
