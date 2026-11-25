import { GoogleGenAI, Type } from '@google/genai';
import {
  AiHttpError,
  MAX_OUTPUT_TOKENS,
  MAX_PROMPT_CHARS,
  sanitizeUserText,
} from './aiSecurity.ts';

const MODEL_ID = 'gemini-4-hydrogen';

export interface ChatTurnInput {
  role: 'user' | 'model';
  text: string;
}

export interface ChatContextInput {
  section?: 'actualidad' | 'comunidad';
  title?: string | null;
  category?: string | null;
  author?: string | null;
  content?: string | null;
}

export interface ChatRequestPayload {
  messages?: ChatTurnInput[];
  prompt?: string;
  message?: string;
  context?: ChatContextInput;
  useSearch?: boolean;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatResponsePayload {
  text: string;
  sources: GroundingSource[];
}

export interface ArcadeChallengeInput {
  prompt: string;
  baseEngine: 'astral' | 'bastion';
}

export interface GeneratedArcadeChallenge {
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

function getServerGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.VITE_GEMINI_API_KEY?.trim() ||
    ''
  );
}

function createGeminiClient(): GoogleGenAI {
  const apiKey = getServerGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      'Falta configurar GEMINI_API_KEY en el entorno del servidor para usar el asistente de IA.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isSafeExternalUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function sanitizeHexColor(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.trim())) {
    return raw.trim();
  }
  return fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Number(num.toFixed(2))));
}

function buildSystemInstruction(context?: ChatContextInput): string {
  const base = [
    'Eres el Asistente IA integrado en Trama, una plataforma editorial y comunitaria en español.',
    'Tus tareas principales son: resumir artículos largos de Actualidad con claridad, responder preguntas de la comunidad y verificar datos recientes usando búsqueda en Google cuando esté activa.',
    'Responde siempre en español natural, directo, conciso y bien estructurado. Usa párrafos breves o viñetas claras para aprovechar bien el límite de extensión.',
    'Si verificas datos con búsqueda web, distingue claramente los hechos confirmados y fechas recientes sin inventar cifras ni fuentes.',
  ];

  if (context && (context.title || context.content)) {
    const sectionLabel =
      context.section === 'comunidad' ? 'Comunidad (hilo)' : 'Actualidad (artículo)';
    const safeTitle =
      typeof context.title === 'string'
        ? sanitizeUserText(context.title).slice(0, 240)
        : '';
    const safeCategory =
      typeof context.category === 'string'
        ? sanitizeUserText(context.category).slice(0, 80)
        : '';
    const safeAuthor =
      typeof context.author === 'string'
        ? sanitizeUserText(context.author).slice(0, 80)
        : '';
    const safeContent =
      typeof context.content === 'string'
        ? sanitizeUserText(context.content).slice(0, 5500)
        : '';

    base.push(
      '',
      '--- CONTEXTO DE LA PUBLICACIÓN ABIERTA EN TRAMA ---',
      `Sección: ${sectionLabel}`,
      safeCategory ? `Categoría: ${safeCategory}` : '',
      safeAuthor ? `Autor: ${safeAuthor}` : '',
      safeTitle ? `Título: ${safeTitle}` : '',
      safeContent ? `Contenido:\n${safeContent}` : '',
      '--- FIN DEL CONTEXTO ---'
    );
  }

  return base.filter(Boolean).join('\n');
}

export async function handleAiChat(
  payload: ChatRequestPayload
): Promise<ChatResponsePayload> {
  if (!payload || typeof payload !== 'object') {
    throw new AiHttpError(400, 'Cuerpo de solicitud inválido.');
  }

  let rawTurns: ChatTurnInput[] = [];
  if (Array.isArray(payload.messages)) {
    rawTurns = payload.messages;
  } else if (typeof payload.prompt === 'string') {
    rawTurns = [{ role: 'user', text: payload.prompt }];
  } else if (typeof payload.message === 'string') {
    rawTurns = [{ role: 'user', text: payload.message }];
  } else {
    throw new AiHttpError(
      400,
      'Envía un mensaje de texto válido para consultar al asistente.'
    );
  }

  if (rawTurns.length === 0) {
    throw new AiHttpError(
      400,
      'Envía al menos un mensaje para consultar al asistente.'
    );
  }

  const recentTurns = rawTurns.slice(-12);
  const sanitizedMessages: Array<{ role: 'user' | 'model'; text: string }> = [];

  for (const turn of recentTurns) {
    if (!turn || typeof turn.text !== 'string') {
      throw new AiHttpError(
        400,
        'Cada mensaje debe ser una cadena de texto válida.'
      );
    }

    const role = turn.role === 'model' ? ('model' as const) : ('user' as const);
    const cleaned = sanitizeUserText(turn.text);

    if (role === 'user') {
      if (cleaned.length === 0) {
        throw new AiHttpError(400, 'El mensaje no puede estar vacío.');
      }
      if (cleaned.length > MAX_PROMPT_CHARS) {
        throw new AiHttpError(
          400,
          `El mensaje supera el límite máximo de ${MAX_PROMPT_CHARS.toLocaleString('es-ES')} caracteres.`
        );
      }
    }

    if (cleaned.length > 0) {
      sanitizedMessages.push({
        role,
        text: role === 'model' ? cleaned.slice(0, 3000) : cleaned,
      });
    }
  }

  if (
    sanitizedMessages.length === 0 ||
    sanitizedMessages[sanitizedMessages.length - 1].role !== 'user'
  ) {
    throw new AiHttpError(400, 'El mensaje del usuario no puede estar vacío.');
  }

  const useSearch = payload.useSearch !== false;
  const ai = createGeminiClient();

  const contents = sanitizedMessages.map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text }],
  }));

  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents,
    config: {
      systemInstruction: buildSystemInstruction(payload.context),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      tools: useSearch ? [{ googleSearch: {} }] : undefined,
    },
  });

  const text = (response.text ?? '').trim();
  const rawChunks =
    response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

  const seenUris = new Set<string>();
  const sources: GroundingSource[] = [];

  for (const chunk of rawChunks) {
    const uri = chunk.web?.uri;
    if (!isSafeExternalUrl(uri) || seenUris.has(uri)) continue;
    seenUris.add(uri);
    const title =
      typeof chunk.web?.title === 'string' && chunk.web.title.trim().length > 0
        ? chunk.web.title.trim().slice(0, 140)
        : new URL(uri).hostname;
    sources.push({ title, uri });
    if (sources.length >= 6) break;
  }

  return {
    text:
      text ||
      'No obtuve una respuesta de texto en este intento. Prueba reformular tu consulta.',
    sources,
  };
}

export async function handleGenerateArcadeChallenge(
  input: ArcadeChallengeInput
): Promise<GeneratedArcadeChallenge> {
  if (!input || typeof input.prompt !== 'string') {
    throw new AiHttpError(
      400,
      'Envía una descripción de texto válida para el desafío arcade.'
    );
  }

  const cleanedPrompt = sanitizeUserText(input.prompt);
  const baseEngine: 'astral' | 'bastion' =
    input.baseEngine === 'bastion' ? 'bastion' : 'astral';

  if (cleanedPrompt.length < 3) {
    throw new AiHttpError(
      400,
      'Describe brevemente la temática del desafío arcade (mínimo 3 caracteres).'
    );
  }

  if (cleanedPrompt.length > MAX_PROMPT_CHARS) {
    throw new AiHttpError(
      400,
      `La descripción supera el límite máximo de ${MAX_PROMPT_CHARS.toLocaleString('es-ES')} caracteres.`
    );
  }

  const ai = createGeminiClient();

  const engineDescription =
    baseEngine === 'astral'
      ? 'Senda Astral (esquivar meteoros y rayos mientras recoges reliquias con dash rápido)'
      : 'Bastión de Runas (defender una ciudadela disparando rayos arcanos a oleadas de espectros y gólems)';

  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: [
      `Diseña un desafío arcade de estética retro-fantasía oscura en español para la sección Arcade de Trama.`,
      `Motor base: ${engineDescription}.`,
      `Idea del Dueño: "${cleanedPrompt}".`,
      `Elige colores oscuros elegantes para bg (ej. #090B12, #0C0A14, #081014) y colores vibrantes de alto contraste para primary, accent y danger.`,
    ].join('\n'),
    config: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Título corto y épico del desafío en español (máx. 32 caracteres).',
          },
          subtitle: {
            type: Type.STRING,
            description: 'Subtítulo breve de 4 a 8 palabras en español.',
          },
          lore: {
            type: Type.STRING,
            description: 'Descripción atmosférica de 1 o 2 frases en español.',
          },
          difficulty: {
            type: Type.STRING,
            description: 'Nivel de dificultad: normal, dificil o extremo.',
          },
          bg: {
            type: Type.STRING,
            description: 'Color hexadecimal muy oscuro para el fondo del lienzo, ej. #0A0D16.',
          },
          primary: {
            type: Type.STRING,
            description: 'Color hexadecimal principal brillante del jugador, ej. #388BFF.',
          },
          accent: {
            type: Type.STRING,
            description: 'Color hexadecimal dorado o luminoso para reliquias/bonos, ej. #FBBF24.',
          },
          danger: {
            type: Type.STRING,
            description: 'Color hexadecimal vibrante para enemigos/peligros, ej. #F43F5E.',
          },
          speedMultiplier: {
            type: Type.NUMBER,
            description: 'Multiplicador de velocidad entre 0.9 y 1.4.',
          },
          spawnMultiplier: {
            type: Type.NUMBER,
            description: 'Multiplicador de densidad de enemigos entre 0.9 y 1.4.',
          },
          playerTitle: {
            type: Type.STRING,
            description: 'Nombre temático del héroe o nave (máx. 24 caracteres).',
          },
          enemyTitle: {
            type: Type.STRING,
            description: 'Nombre temático de los enemigos (máx. 24 caracteres).',
          },
        },
        required: [
          'title',
          'subtitle',
          'lore',
          'difficulty',
          'bg',
          'primary',
          'accent',
          'danger',
          'speedMultiplier',
          'spawnMultiplier',
          'playerTitle',
          'enemyTitle',
        ],
      },
    },
  });

  const rawText = (response.text ?? '').trim();
  const parsed = JSON.parse(rawText) as Record<string, unknown>;

  const rawDiff = String(parsed.difficulty ?? 'normal').toLowerCase();
  const difficulty: 'normal' | 'dificil' | 'extremo' =
    rawDiff.includes('extrem')
      ? 'extremo'
      : rawDiff.includes('dif')
        ? 'dificil'
        : 'normal';

  return {
    title:
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim().slice(0, 40)
        : 'Desafío Arcano',
    subtitle:
      typeof parsed.subtitle === 'string' && parsed.subtitle.trim()
        ? parsed.subtitle.trim().slice(0, 80)
        : 'Reto retro-fantasía creado por el Dueño',
    lore:
      typeof parsed.lore === 'string' && parsed.lore.trim()
        ? parsed.lore.trim().slice(0, 220)
        : 'Sobrevive a la tormenta rúnica y supera el récord del salón Arcade.',
    difficulty,
    baseEngine,
    palette: {
      bg: sanitizeHexColor(parsed.bg, '#090C14'),
      primary: sanitizeHexColor(parsed.primary, '#388BFF'),
      accent: sanitizeHexColor(parsed.accent, '#FBBF24'),
      danger: sanitizeHexColor(parsed.danger, '#F43F5E'),
    },
    speedMultiplier: clampNumber(parsed.speedMultiplier, 0.85, 1.45, 1.1),
    spawnMultiplier: clampNumber(parsed.spawnMultiplier, 0.85, 1.45, 1.1),
    playerTitle:
      typeof parsed.playerTitle === 'string' && parsed.playerTitle.trim()
        ? parsed.playerTitle.trim().slice(0, 32)
        : 'Centinela',
    enemyTitle:
      typeof parsed.enemyTitle === 'string' && parsed.enemyTitle.trim()
        ? parsed.enemyTitle.trim().slice(0, 32)
        : 'Sombras',
  };
}
