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

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
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
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: params.messages,
      context: params.context,
      useSearch: params.useSearch ?? true,
    }),
  });

  return parseJsonResponse<AiChatResponse>(response);
}

export async function generateAiArcadeChallenge(params: {
  prompt: string;
  baseEngine: 'astral' | 'bastion';
}): Promise<AiArcadeChallenge> {
  const response = await fetch('/api/ai/arcade-challenge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const data = await parseJsonResponse<{ challenge: AiArcadeChallenge }>(
    response
  );
  return data.challenge;
}
