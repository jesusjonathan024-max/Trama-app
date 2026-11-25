import { Fragment, useMemo } from 'react';
import { getHashtagTone } from '../lib/categoryColors';
import { splitTextWithHashtags } from '../lib/hashtags';

interface HashtagTextProps {
  text: string;
  onSelectHashtag: (tag: string) => void;
  className?: string;
}

export function HashtagText({
  text,
  onSelectHashtag,
  className = '',
}: HashtagTextProps) {
  const segments = useMemo(() => splitTextWithHashtags(text), [text]);

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'hashtag') {
          const tone = getHashtagTone(segment.value);
          return (
            <button
              key={`${segment.key}-${index}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectHashtag(segment.value);
              }}
              className={`inline font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded-sm transition-colors ${tone.inline}`}
            >
              {segment.value}
            </button>
          );
        }
        return <Fragment key={index}>{segment.value}</Fragment>;
      })}
    </span>
  );
}
