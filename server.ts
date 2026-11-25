import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  handleAiChat,
  handleGenerateArcadeChallenge,
  type ArcadeChallengeInput,
  type ChatRequestPayload,
} from './server/geminiHandler.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const payload = req.body as ChatRequestPayload;
      const result = await handleAiChat(payload);
      res.json(result);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'No se pudo procesar la consulta con Gemini.';
      const status = message.includes('Envía al menos') || message.includes('vacío') ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/ai/arcade-challenge', async (req, res) => {
    try {
      const payload = req.body as ArcadeChallengeInput;
      const challenge = await handleGenerateArcadeChallenge(payload);
      res.json({ challenge });
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'No se pudo generar el desafío arcade con Gemini.';
      const status = message.includes('Describe brevemente') ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

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
