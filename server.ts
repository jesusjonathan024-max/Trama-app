import 'dotenv/config';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AiHttpError,
  MAX_AI_BODY_BYTES,
  assertPayloadSizeWithinLimit,
  buildCorsHeaders,
  isOriginAllowed,
  normalizeOrigin,
  verifySupabaseUserAndConsumeQuota,
} from './server/aiSecurity.ts';
import {
  handleAiChat,
  handleGenerateArcadeChallenge,
  type ArcadeChallengeInput,
  type ChatRequestPayload,
} from './server/geminiHandler.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

const SERVER_EXTRA_ORIGINS: ReadonlySet<string> = (() => {
  const extras = new Set<string>([`http://localhost:${PORT}`]);
  const appUrlOrigin = normalizeOrigin(process.env.APP_URL);
  if (appUrlOrigin) extras.add(appUrlOrigin);
  return extras;
})();

async function startServer() {
  const app = express();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Router protegido para /api/ai/*
  const aiRouter = express.Router();

  // 1. Control estricto de origen (CORS)
  aiRouter.use((req, res, next) => {
    const origin = req.headers.origin;

    if (!isOriginAllowed(origin, SERVER_EXTRA_ORIGINS)) {
      res.setHeader('Vary', 'Origin');
      res.status(403).json({ error: 'Origen no permitido.' });
      return;
    }

    const corsHeaders = buildCorsHeaders(origin, SERVER_EXTRA_ORIGINS);
    for (const [key, value] of Object.entries(corsHeaders)) {
      res.setHeader(key, value);
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    // Validación previa de Content-Length (> 15 KB -> 413)
    const contentLength = req.headers['content-length'];
    if (contentLength) {
      const declaredBytes = Number(contentLength);
      if (Number.isFinite(declaredBytes) && declaredBytes > MAX_AI_BODY_BYTES) {
        res.status(413).json({
          error: 'La solicitud supera el límite máximo permitido de 15 KB.',
        });
        return;
      }
    }

    next();
  });

  // 2. Parser JSON limitado estrictamente a 15 KB
  aiRouter.use(
    express.json({
      limit: MAX_AI_BODY_BYTES,
      verify: (_req, _res, buf) => {
        assertPayloadSizeWithinLimit(buf.byteLength);
      },
    })
  );

  // Manejo limpio de errores de tamaño (> 15 KB -> 413) y JSON malformado (-> 400)
  aiRouter.use(
    (
      err: unknown,
      _req: Request,
      res: Response,
      next: NextFunction
    ) => {
      if (!err) {
        next();
        return;
      }

      if (err instanceof AiHttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }

      const bodyErr = err as { status?: number; type?: string };
      if (bodyErr.status === 413 || bodyErr.type === 'entity.too.large') {
        res.status(413).json({
          error: 'La solicitud supera el límite máximo permitido de 15 KB.',
        });
        return;
      }

      if (bodyErr.status === 400 || err instanceof SyntaxError) {
        res.status(400).json({
          error: 'El cuerpo JSON de la solicitud no es válido.',
        });
        return;
      }

      next(err);
    }
  );

  aiRouter.post('/chat', async (req, res) => {
    try {
      await verifySupabaseUserAndConsumeQuota(req.headers.authorization);
      const payload = req.body as ChatRequestPayload;
      const result = await handleAiChat(payload);
      res.json(result);
    } catch (err) {
      if (err instanceof AiHttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'No se pudo procesar la consulta con Gemini.';
      res.status(500).json({ error: message });
    }
  });

  aiRouter.post('/arcade-challenge', async (req, res) => {
    try {
      await verifySupabaseUserAndConsumeQuota(req.headers.authorization, {
        requireOwner: true,
      });
      const payload = req.body as ArcadeChallengeInput;
      const challenge = await handleGenerateArcadeChallenge(payload);
      res.json({ challenge });
    } catch (err) {
      if (err instanceof AiHttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'No se pudo generar el desafío arcade con Gemini.';
      res.status(500).json({ error: message });
    }
  });

  app.use('/api/ai', aiRouter);

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Trama server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
