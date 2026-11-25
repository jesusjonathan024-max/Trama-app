import { supabase } from './supabase';

// Bandera global para activar o desactivar temporalmente las funciones visuales de IA
export const ENABLE_AI_FEATURES = false;

export const MAX_AI_PROMPT_LENGTH = 2000;

export interface AiChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface AiChatContext {
  section: 'actualidad' | 'comunidad';
  title?: string | null;
  category?: string | null;
  author?: string | null;
  content?: string | null;
}

export interface AiGroundingSource {
  title: string;
  uri: string;
}

export interface AiChatResponse {
  text: string;
  sources: AiGroundingSource[];
}

export interface AiArcadeChallenge {
  title: string;
  subtitle: string;
  lore: string;
  difficulty: 'normal' | 'dificil' | 'extremo';
  baseEngine: 'astral' | 'bastion';
  palette: {
    bg: string;
    primary: string;
    accent: string;
    danger: string;
  };
  speedMultiplier: number;
  spawnMultiplier: number;
  playerTitle: string;
  enemyTitle: string;
}

async function getSupabaseAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token?.trim();
  if (!accessToken) {
    throw new Error(
      'Debes iniciar sesión en Trama para usar el Asistente IA.'
    );
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

function cleanClientText(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (response.status === 413) {
      throw new Error(
        'La solicitud supera el límite máximo permitido de 15 KB.'
      );
    }
    throw new Error(
      'El servicio de IA no respondió en formato JSON. Verifica que el servidor esté activo.'
    );
  }
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(
      data?.error || 'No se pudo completar la solicitud con Gemini.'
    );
  }
  return data;
}

export async function sendAiChat(params: {
  messages: AiChatTurn[];
  context?: AiChatContext;
  useSearch?: boolean;
}): Promise<AiChatResponse> {
  const headers = await getSupabaseAuthHeaders();

  const recentTurns = params.messages.slice(-8).map((turn) => ({
    role: turn.role,
    text: cleanClientText(turn.text),
  }));

  const lastTurn = recentTurns[recentTurns.length - 1];
  if (!lastTurn || lastTurn.role !== 'user' || lastTurn.text.length === 0) {
    throw new Error('Escribe un mensaje antes de enviarlo al asistente.');
  }
  if (lastTurn.text.length > MAX_AI_PROMPT_LENGTH) {
    throw new Error(
      `El mensaje no puede superar los ${MAX_AI_PROMPT_LENGTH.toLocaleString('es-ES')} caracteres.`
    );
  }

  const trimmedContext = params.context
    ? {
        section: params.context.section,
        title: params.context.title
          ? cleanClientText(params.context.title).slice(0, 220)
          : null,
        category: params.context.category
          ? cleanClientText(params.context.category).slice(0, 80)
          : null,
        author: params.context.author
          ? cleanClientText(params.context.author).slice(0, 80)
          : null,
        content: params.context.content
          ? cleanClientText(params.context.content).slice(0, 4500)
          : null,
      }
    : undefined;

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: recentTurns,
      context: trimmedContext,
      useSearch: params.useSearch ?? true,
    }),
  });

  return parseJsonResponse<AiChatResponse>(response);
}

export async function generateAiArcadeChallenge(params: {
  prompt: string;
  baseEngine: 'astral' | 'bastion';
}): Promise<AiArcadeChallenge> {
  const headers = await getSupabaseAuthHeaders();
  const cleanedPrompt = cleanClientText(params.prompt);

  if (cleanedPrompt.length < 3) {
    throw new Error(
      'Describe brevemente la temática del desafío arcade (mínimo 3 caracteres).'
    );
  }
  if (cleanedPrompt.length > MAX_AI_PROMPT_LENGTH) {
    throw new Error(
      `La descripción no puede superar los ${MAX_AI_PROMPT_LENGTH.toLocaleString('es-ES')} caracteres.`
    );
  }

  const response = await fetch('/api/ai/arcade-challenge', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt: cleanedPrompt,
      baseEngine: params.baseEngine,
    }),
  });

  const data = await parseJsonResponse<{ challenge: AiArcadeChallenge }>(
    response
  );
  return data.challenge;
}

export async function summarizeArticleExecutive(params: {
  title?: string | null;
  category?: string | null;
  author?: string | null;
  content: string;
}): Promise<AiChatResponse> {
  return sendAiChat({
    messages: [
      {
        role: 'user',
        text: 'Resume este artículo en exactamente 3 puntos clave ejecutivos, claros, neutrales y concretos en español. Usa una lista con viñetas (una idea por viñeta, máximo 2 líneas cada una) y sin introducción ni despedida.',
      },
    ],
    context: {
      section: 'actualidad',
      title: params.title ?? null,
      category: params.category ?? null,
      author: params.author ?? null,
      content: params.content,
    },
    useSearch: false,
  });
}
