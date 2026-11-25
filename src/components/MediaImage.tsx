import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { isSafeHttpUrl } from '../lib/supabase';

interface MediaImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

export function MediaImage({
  src,
  alt,
  className = '',
  fallbackClassName = '',
}: MediaImageProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!isSafeHttpUrl(src)) {
    return null;
  }

  if (hasError) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center gap-2 bg-[#141923] border border-white/[0.08] text-[#7D8799] ${fallbackClassName || className}`}
      >
        <ImageOff size={22} aria-hidden="true" />
        <span className="text-xs">Imagen no disponible</span>
      </div>
    );
  }

  return (
    <img
      src={src!}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
