export interface HashtagMatch {
  key: string;
  display: string;
}

export interface PopularHashtag {
  key: string;
  display: string;
  count: number;
}

export type TextSegment =
  | { type: 'text'; value: string }
  | { type: 'hashtag'; value: string; key: string };

const HASHTAG_PATTERN = /#([\p{L}\p{N}_]{2,40})/gu;

export function normalizeHashtag(raw: string): string {
  const cleaned = raw.trim().replace(/^#+/, '').toLowerCase();
  return cleaned.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function formatHashtagDisplay(raw: string): string {
  const cleaned = raw.trim().replace(/^#+/, '');
  return cleaned ? `#${cleaned}` : '';
}

export function extractHashtags(text: string): HashtagMatch[] {
  if (!text) return [];
  const seen = new Map<string, string>();
  const matches = text.matchAll(HASHTAG_PATTERN);

  for (const match of matches) {
    const rawTag = match[1];
    if (!rawTag) continue;
    const key = normalizeHashtag(rawTag);
    if (!key || seen.has(key)) continue;
    seen.set(key, `#${rawTag}`);
  }

  return Array.from(seen.entries()).map(([key, display]) => ({
    key,
    display,
  }));
}

export function postHasHashtag(
  post: { title: string | null; content: string },
  activeHashtag: string
): boolean {
  const targetKey = normalizeHashtag(activeHashtag);
  if (!targetKey) return true;
  const combined = `${post.title ?? ''} ${post.content ?? ''}`;
  const tags = extractHashtags(combined);
  return tags.some((tag) => tag.key === targetKey);
}

export function getPopularHashtags(
  posts: Array<{ title: string | null; content: string }>,
  limit = 10
): PopularHashtag[] {
  const counts = new Map<string, { display: string; count: number }>();

  for (const post of posts) {
    const combined = `${post.title ?? ''} ${post.content ?? ''}`;
    const uniqueInPost = extractHashtags(combined);
    for (const tag of uniqueInPost) {
      const existing = counts.get(tag.key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(tag.key, { display: tag.display, count: 1 });
      }
    }
  }

  return Array.from(counts.entries())
    .map(([key, info]) => ({
      key,
      display: info.display,
      count: info.count,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.display.localeCompare(b.display, 'es');
    })
    .slice(0, limit);
}

export function splitTextWithHashtags(text: string): TextSegment[] {
  if (!text) return [];

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(HASHTAG_PATTERN)) {
    const fullMatch = match[0];
    const tagBody = match[1];
    const index = match.index ?? 0;

    // Evita interpretar fragmentos pegados a letras/números (p.ej. URL#ancla)
    const prevChar = index > 0 ? text[index - 1] : '';
    const isEmbeddedWord = prevChar !== '' && /[\p{L}\p{N}_/]/u.test(prevChar);
    if (isEmbeddedWord || !tagBody) {
      continue;
    }

    if (index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, index) });
    }

    segments.push({
      type: 'hashtag',
      value: fullMatch,
      key: normalizeHashtag(tagBody),
    });

    lastIndex = index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}
