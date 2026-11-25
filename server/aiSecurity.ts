import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  DEFAULT_SUPABASE_URL,
} from '../src/lib/supabaseConfig.ts';

export const MAX_AI_BODY_BYTES = 15 * 1024; // 15 KB
export const MAX_PROMPT_CHARS = 2000;
export const MAX_OUTPUT_TOKENS = 800;

export const ALLOWED_CORS_ORIGINS = new Set<string>([
  'https://trama-app.netlify.app',
  'http://localhost:5173',
  'http://localhost:8888',
]);

export class AiHttpError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AiHttpError';
    this.status = status;
  }
}

export function normalizeOrigin(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return new URL(raw.trim()).origin;
  } catch {
    return null;
  }
}

export function isOriginAllowed(
  originHeader: string | null | undefined,
  extraAllowedOrigins?: ReadonlySet<string>
): boolean {
  if (!originHeader) return true;
  const normalized = normalizeOrigin(originHeader);
  if (!normalized) return false;
  if (ALLOWED_CORS_ORIGINS.has(normalized)) return true;
  if (extraAllowedOrigins?.has(normalized)) return true;
  return false;
}

export function buildCorsHeaders(
  originHeader: string | null | undefined,
  extraAllowedOrigins?: ReadonlySet<string>
): Record<string, string> {
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (originHeader && isOriginAllowed(originHeader, extraAllowedOrigins)) {
    const normalized = normalizeOrigin(originHeader);
    if (normalized) {
      headers['Access-Control-Allow-Origin'] = normalized;
    }
  }

  return headers;
}

export function sanitizeUserText(raw: string): string {
  // Elimina caracteres de control innecesarios conservando saltos de línea y tabulaciones
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

export function assertPayloadSizeWithinLimit(byteLength: number): void {
  if (!Number.isFinite(byteLength) || byteLength > MAX_AI_BODY_BYTES) {
    throw new AiHttpError(
      413,
      'La solicitud supera el límite máximo permitido de 15 KB.'
    );
  }
}

function extractBearerToken(authorizationHeader: string | null | undefined): string {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    throw new AiHttpError(
      401,
      'Debes iniciar sesión para usar el Asistente IA.'
    );
  }

  const match = authorizationHeader.trim().match(/^Bearer\s+(\S+)$/i);
  if (!match || !match[1]) {
    throw new AiHttpError(
      401,
      'Token de autenticación inválido. Inicia sesión nuevamente.'
    );
  }

  return match[1];
}

function getSupabaseServerConfig(): { url: string; publishableKey: string } {
  const url =
    process.env.VITE_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    DEFAULT_SUPABASE_URL;

  const publishableKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new AiHttpError(
      500,
      'Falta configurar VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en el servidor.'
    );
  }

  return { url, publishableKey };
}

interface ConsumeAiQuotaResult {
  allowed?: boolean;
  error?: string | null;
}

export async function verifySupabaseUserAndConsumeQuota(
  authorizationHeader: string | null | undefined,
  options?: { requireOwner?: boolean }
): Promise<{ userId: string }> {
  const accessToken = extractBearerToken(authorizationHeader);
  const { url, publishableKey } = getSupabaseServerConfig();

  const supabase = createClient(url, publishableKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken);

  if (userError || !userData?.user) {
    throw new AiHttpError(
      401,
      'Tu sesión no es válida o ha expirado. Inicia sesión nuevamente.'
    );
  }

  if (options?.requireOwner) {
    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle();

    const role = (profileRow?.role ?? '').trim().toLowerCase();
    if (profileError || role !== 'owner') {
      throw new AiHttpError(
        403,
        'Solo el Dueño de Trama puede generar desafíos Arcade con IA.'
      );
    }
  }

  const { data: rpcData, error: rpcError } =
    await supabase.rpc('consume_ai_quota');

  const quotaResult: ConsumeAiQuotaResult | null = Array.isArray(rpcData)
    ? ((rpcData[0] as ConsumeAiQuotaResult | undefined) ?? null)
    : ((rpcData as ConsumeAiQuotaResult | null) ?? null);

  if (rpcError || !quotaResult?.allowed) {
    const quotaMessage =
      (typeof quotaResult?.error === 'string' && quotaResult.error.trim()) ||
      (typeof rpcError?.message === 'string' && rpcError.message.trim()) ||
      'Has alcanzado el límite diario de consultas al Asistente IA. Inténtalo más tarde.';
    throw new AiHttpError(429, quotaMessage);
  }

  return { userId: userData.user.id };
}
