import { supabase } from './supabase';

export type PollDurationOption = '24h' | '3d' | '7d' | 'none';

export const POLL_DURATION_OPTIONS: ReadonlyArray<{
  value: PollDurationOption;
  label: string;
}> = [
  { value: '24h', label: '24 horas' },
  { value: '3d', label: '3 días' },
  { value: '7d', label: '7 días' },
  { value: 'none', label: 'Sin límite' },
];

export interface PostPollData {
  id: string;
  post_id: string;
  question: string;
  options: string[];
  ends_at: string | null;
  created_at: string;
  counts: number[];
  totalVotes: number;
  userVoteIndex: number | null;
}

interface RawPollRow {
  id: string;
  post_id: string;
  question: string;
  options: unknown;
  ends_at: string | null;
  created_at: string;
}

interface RawPollVoteRow {
  poll_id: string;
  user_id: string;
  option_index: number;
}

function normalizePollOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

export function computePollEndsAt(duration: PollDurationOption): string | null {
  if (duration === 'none') return null;
  const now = Date.now();
  const hours = duration === '24h' ? 24 : duration === '3d' ? 72 : 168;
  return new Date(now + hours * 60 * 60 * 1000).toISOString();
}

export function isPollExpired(endsAt: string | null): boolean {
  if (!endsAt) return false;
  const time = new Date(endsAt).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() >= time;
}

export function formatPollTimeRemaining(endsAt: string | null): string {
  if (!endsAt) return 'Sin límite';
  const endMs = new Date(endsAt).getTime();
  if (Number.isNaN(endMs)) return 'Sin límite';
  const diffMs = endMs - Date.now();
  if (diffMs <= 0) return 'Encuesta cerrada';

  const totalMinutes = Math.floor(diffMs / 60000);
  if (totalMinutes < 60) {
    return `Cierra en ${Math.max(1, totalMinutes)} min`;
  }
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    return `Cierra en ${totalHours} h`;
  }
  const totalDays = Math.ceil(totalHours / 24);
  return `Cierra en ${totalDays} ${totalDays === 1 ? 'día' : 'días'}`;
}

export async function createPostPoll(params: {
  postId: string;
  question: string;
  options: string[];
  duration: PollDurationOption;
}): Promise<void> {
  const cleanedQuestion = params.question.trim();
  const cleanedOptions = params.options
    .map((opt) => opt.trim())
    .filter((opt) => opt.length > 0);

  if (!cleanedQuestion) {
    throw new Error('Escribe la pregunta de la encuesta.');
  }
  if (cleanedOptions.length < 2 || cleanedOptions.length > 4) {
    throw new Error('La encuesta debe tener entre 2 y 4 opciones de respuesta.');
  }

  const endsAt = computePollEndsAt(params.duration);

  const { error } = await supabase.from('post_polls').insert({
    post_id: params.postId,
    question: cleanedQuestion,
    options: cleanedOptions,
    ends_at: endsAt,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchPollsForPosts(
  postIds: string[],
  currentUserId?: string | null
): Promise<Record<string, PostPollData>> {
  const uniqueIds = Array.from(new Set(postIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const { data: pollRows, error: pollsError } = await supabase
    .from('post_polls')
    .select('id, post_id, question, options, ends_at, created_at')
    .in('post_id', uniqueIds);

  if (pollsError) {
    throw new Error(pollsError.message);
  }

  const rawPolls = (pollRows ?? []) as RawPollRow[];
  if (rawPolls.length === 0) return {};

  const pollIds = rawPolls.map((p) => p.id);
  const { data: voteRows, error: votesError } = await supabase
    .from('poll_votes')
    .select('poll_id, user_id, option_index')
    .in('poll_id', pollIds);

  if (votesError) {
    throw new Error(votesError.message);
  }

  const votesByPoll = new Map<string, RawPollVoteRow[]>();
  for (const row of (voteRows ?? []) as RawPollVoteRow[]) {
    const list = votesByPoll.get(row.poll_id) ?? [];
    list.push(row);
    votesByPoll.set(row.poll_id, list);
  }

  const result: Record<string, PostPollData> = {};

  for (const poll of rawPolls) {
    const options = normalizePollOptions(poll.options);
    if (options.length < 2) continue;

    const counts = new Array<number>(options.length).fill(0);
    let totalVotes = 0;
    let userVoteIndex: number | null = null;

    const votes = votesByPoll.get(poll.id) ?? [];
    for (const vote of votes) {
      const idx = Number(vote.option_index);
      if (Number.isInteger(idx) && idx >= 0 && idx < options.length) {
        counts[idx] += 1;
        totalVotes += 1;
        if (currentUserId && vote.user_id === currentUserId) {
          userVoteIndex = idx;
        }
      }
    }

    result[poll.post_id] = {
      id: poll.id,
      post_id: poll.post_id,
      question: poll.question,
      options,
      ends_at: poll.ends_at ?? null,
      created_at: poll.created_at,
      counts,
      totalVotes,
      userVoteIndex,
    };
  }

  return result;
}

export async function fetchPollForPost(
  postId: string,
  currentUserId?: string | null
): Promise<PostPollData | null> {
  if (!postId) return null;
  const map = await fetchPollsForPosts([postId], currentUserId);
  return map[postId] ?? null;
}

export async function voteOnPoll(params: {
  pollId: string;
  userId: string;
  optionIndex: number;
}): Promise<void> {
  const { error } = await supabase.from('poll_votes').upsert(
    {
      poll_id: params.pollId,
      user_id: params.userId,
      option_index: params.optionIndex,
    },
    { onConflict: 'poll_id,user_id' }
  );

  if (error) {
    if (error.code === '42P10' || error.message.includes('ON CONFLICT')) {
      const { data: existing } = await supabase
        .from('poll_votes')
        .select('poll_id')
        .eq('poll_id', params.pollId)
        .eq('user_id', params.userId)
        .maybeSingle();

      if (existing) {
        const { error: updateErr } = await supabase
          .from('poll_votes')
          .update({ option_index: params.optionIndex })
          .eq('poll_id', params.pollId)
          .eq('user_id', params.userId);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        const { error: insertErr } = await supabase.from('poll_votes').insert({
          poll_id: params.pollId,
          user_id: params.userId,
          option_index: params.optionIndex,
        });
        if (insertErr) throw new Error(insertErr.message);
      }
    } else {
      throw new Error(error.message);
    }
  }
}
