import {
  handleAiChat,
  handleGenerateArcadeChallenge,
  type ArcadeChallengeInput,
  type ChatRequestPayload,
} from '../../server/geminiHandler.ts';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';

  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (action === 'arcade-challenge' || url.pathname.endsWith('/arcade-challenge')) {
      const challenge = await handleGenerateArcadeChallenge(
        body as unknown as ArcadeChallengeInput
      );
      return new Response(JSON.stringify({ challenge }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await handleAiChat(body as unknown as ChatRequestPayload);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : 'Error al consultar el servicio de IA.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
