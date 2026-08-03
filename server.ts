import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config({ path: process.env.ENV_FILE || '.env' });

const PORT = Number(process.env.PORT || 3000);
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 30000);
const AI_RATE_LIMIT = Number(process.env.AI_RATE_LIMIT || 30);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

const allowedOrigins = new Set<string>();
if (process.env.APP_URL) {
  try { allowedOrigins.add(new URL(process.env.APP_URL).origin); } catch { /* invalid APP_URL is ignored */ }
}

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin === 'tauri://localhost';
}

const rateBuckets = new Map<string, { startedAt: number; count: number }>();
function aiRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || req.socket.remoteAddress || 'local';
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= 60000) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    next();
    return;
  }
  bucket.count += 1;
  if (bucket.count > AI_RATE_LIMIT) {
    res.status(429).json({ error: 'RATE_LIMITED', message: 'AI 請求過於頻繁，請稍後再試。' });
    return;
  }
  next();
}

const analysisCache = new Map<string, { expiresAt: number; analysis: string }>();

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`AI request timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin)) {
      res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
      return;
    }
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'poker-coach-pro', aiConfigured: Boolean(process.env.GEMINI_API_KEY) });
  });

  app.post('/api/poker/mindset', aiRateLimit, async (req, res) => {
    try {
      const { scenario, currentStep, message, history = [] } = req.body || {};
      if (!scenario || !currentStep || typeof currentStep.description !== 'string') {
        res.status(400).json({ error: 'INVALID_HAND', message: '缺少有效的牌局或決策步驟。' });
        return;
      }
      if (message && (typeof message !== 'string' || message.length > 2000)) {
        res.status(400).json({ error: 'INVALID_MESSAGE', message: '追問內容不可超過 2,000 字。' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(400).json({ error: 'GEMINI_API_KEY_MISSING', message: '線上 AI 模式需要在 .env 設定 GEMINI_API_KEY；也可以切回離線模式。' });
        return;
      }

      const handContext = {
        title: scenario.title,
        gameType: scenario.type,
        difficulty: scenario.difficulty,
        blinds: scenario.blinds,
        ante: scenario.ante,
        position: scenario.position,
        effectiveStack: scenario.effectiveStack,
        heroStackBB: scenario.userBB,
        villainProfile: scenario.villainProfile,
        holeCards: scenario.holeCards,
        preAction: scenario.preAction,
        street: currentStep.street,
        communityCards: currentStep.communityCards,
        potSizeBB: currentStep.potSize,
        potOdds: currentStep.potOdds,
        spr: currentStep.spr,
        decision: currentStep.description,
        structuredState: currentStep.handState,
        assumptions: currentStep.assumptions,
        strategySource: currentStep.strategySource,
      };

      const systemInstruction = `你是謹慎、務實的德州撲克教練。請使用繁體中文與 Markdown 回答。
先區分可由牌局資料直接算出的事實、題庫教學假設，以及策略推論。資料不足時明確說明假設，不要捏造精確 GTO 頻率或對手範圍。
分析順序：1. 重建行動線與底池；2. 估計雙方範圍與牌面互動；3. 比較可選動作、尺寸與後續街計畫；4. 給出簡潔結論。
若題目附有 assumptions 或 strategySource，必須揭露其限制。不要把一般教學答案宣稱為求解器唯一解。`;

      const prompt = message
        ? `牌局資料：\n${JSON.stringify(handContext, null, 2)}\n\n使用者追問：${message}`
        : `請分析這個決策點，包含範圍、數學、尺寸與後續街計畫：\n${JSON.stringify(handContext, null, 2)}`;

      const cacheKey = message ? '' : JSON.stringify(handContext);
      const cached = cacheKey ? analysisCache.get(cacheKey) : undefined;
      if (cached && cached.expiresAt > Date.now()) {
        res.json({ analysis: cached.analysis, cached: true });
        return;
      }

      const safeHistory = Array.isArray(history) ? history.slice(-12).filter(item => item && typeof item.text === 'string').map(item => ({
        role: item.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(item.text).slice(0, 4000) }],
      })) : [];
      const contents = [...safeHistory, { role: 'user', parts: [{ text: prompt }] }];
      const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'poker-coach-pro' } } });
      const response = await withTimeout(ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: { systemInstruction, temperature: 0.35 },
      }), AI_TIMEOUT_MS);

      const analysis = response.text || 'AI 沒有回傳分析內容。';
      if (cacheKey) {
        analysisCache.set(cacheKey, { expiresAt: Date.now() + 30 * 60 * 1000, analysis });
        if (analysisCache.size > 100) analysisCache.delete(analysisCache.keys().next().value as string);
      }
      res.json({ analysis, cached: false });
    } catch (error: any) {
      console.error('Gemini API error:', error);
      const timedOut = String(error?.message || '').includes('timed out');
      res.status(timedOut ? 504 : 500).json({
        error: timedOut ? 'GEMINI_TIMEOUT' : 'GEMINI_API_ERROR',
        message: timedOut ? 'AI 分析逾時，請稍後再試。' : (error?.message || 'Gemini API 暫時無法完成分析。'),
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Poker Coach Pro running on http://localhost:${PORT}`));
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exitCode = 1;
});
