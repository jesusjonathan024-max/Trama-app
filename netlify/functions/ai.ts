import {
  AiHttpError,
  assertPayloadSizeWithinLimit,
  buildCorsHeaders,
  isOriginAllowed,
  verifySupabaseUserAndConsumeQuota,
} from '../../server/aiSecurity.ts';
import {
  handleAiChat,
  handleGenerateArcadeChallenge,
  type ArcadeChallengeInput,
  type ChatRequestPayload,
} from '../../server/geminiHandler.ts';

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
    },
  });
}

export default async function handler(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');

  if (!isOriginAllowed(origin)) {
    return new Response(JSON.stringify({ error: 'Origen no permitido.' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Vary: 'Origin',
      },
    });
  }

  const corsHeaders = buildCorsHeaders(origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido.' }, corsHeaders);
  }

  try {
    const contentLengthHeader = request.headers.get('content-length');
    if (contentLengthHeader) {
      const declaredBytes = Number(contentLengthHeader);
      if (Number.isFinite(declaredBytes)) {
        assertPayloadSizeWithinLimit(declaredBytes);
      }
    }

    const rawBody = await request.text();
    const actualBytes = new TextEncoder().encode(rawBody).byteLength;
    assertPayloadSizeWithinLimit(actualBytes);

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new AiHttpError(400, 'El cuerpo de la solicitud debe ser un objeto JSON.');
      }
      body = parsed as Record<string, unknown>;
    } catch (parseErr) {
      if (parseErr instanceof AiHttpError) throw parseErr;
      throw new AiHttpError(400, 'El cuerpo JSON de la solicitud no es válido.');
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action') || '';
    const isArcadeChallenge =
      action === 'arcade-challenge' ||
      url.pathname.endsWith('/arcade-challenge');

    await verifySupabaseUserAndConsumeQuota(
      request.headers.get('authorization'),
      { requireOwner: isArcadeChallenge }
    );

    if (isArcadeChallenge) {
      const challenge = await handleGenerateArcadeChallenge(
        body as unknown as ArcadeChallengeInput
      );
      return jsonResponse(200, { challenge }, corsHeaders);
    }

    const result = await handleAiChat(body as unknown as ChatRequestPayload);
    return jsonResponse(
      200,
      result as unknown as Record<string, unknown>,
      corsHeaders
    );
  } catch (err) {
    if (err instanceof AiHttpError) {
      return jsonResponse(err.status, { error: err.message }, corsHeaders);
    }

    const message =
      err instanceof Error && err.message
        ? err.message
        : 'Error al consultar el servicio de IA.';
    return jsonResponse(500, { error: message }, corsHeaders);
  }
}
