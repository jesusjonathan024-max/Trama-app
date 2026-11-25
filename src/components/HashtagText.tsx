import { Fragment, useMemo } from 'react';
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
      {segments.map((segment, index) =>
        segment.type === 'hashtag' ? (
          <button
            key={`${segment.key}-${index}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectHashtag(segment.value);
            }}
            className="inline font-semibold text-[var(--accent-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded-sm transition-colors"
          >
            {segment.value}
          </button>
        ) : (
          <Fragment key={index}>{segment.value}</Fragment>
        )
      )}
    </span>
  );
}
