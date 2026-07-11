import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS Middleware to allow requests from Tauri (tauri://localhost) and other origins in dev
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // API route for AI Poker Mindset analysis
  app.post("/api/poker/mindset", async (req, res) => {
    try {
      const { scenario, currentStep, message, history = [] } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: "GEMINI_API_KEY_MISSING",
          message: "尚未設定 Gemini API 金鑰，請在右上方【Settings > Secrets】中新增 GEMINI_API_KEY。"
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Construct a structured card list string
      const heroCardsStr = scenario?.holeCards ? scenario.holeCards.map((c: any) => `${c.rank}${c.suit}`).join(', ') : "未知";
      const boardCardsStr = currentStep?.communityCards && currentStep.communityCards.length > 0
        ? currentStep.communityCards.map((c: any) => `${c.rank}${c.suit}`).join(', ')
        : "無 (Preflop)";

      // Construct the prompt context
      const context = `
=== 德州撲克戰局脈絡 ===
標題: ${scenario?.title || "未知戰局"}
難度: ${scenario?.difficulty || "中階"}
戰局概況: ${scenario?.situation || "無"}
英雄(Hero)手牌: ${heroCardsStr}
當前街 (Street): ${currentStep?.street || "未知"}
公共牌 (Board): ${boardCardsStr}
底池大小: ${currentStep?.potSize || "未知"} BB
英雄位置: ${scenario?.position || "未知"}
有效籌碼: ${scenario?.effectiveStack || "未知"} (${scenario?.userBB || "未知"} BB)
對手形象/風格 (Villain Profile): ${scenario?.villainProfile || "常規玩家 (REG)"}
當前情境描述: ${currentStep?.description || "無"}
`;

      const systemInstruction = `你是一位世界級的德州撲克高階教練，同時也是心理戰大師與 GTO (Game Theory Optimal) 專家。
你的任務是針對玩家提供的德州撲克戰局情境，進行精確的「對手心態與範圍分析」。
請以極具親和力且專業、冷靜的語氣回答。

請使用繁體中文撰寫，並用 Markdown 格式進行結構化排版，包含以下幾個重點區塊：
1. **🧠 對手心態解析 (Mindset & Motivation)**：分析對手在該特定玩家形象 (Villain Profile) 以及下注行為下的心理動機。他是價值下注、強買聽牌、純粹詐唬，還是範圍合併？
2. **🃏 手牌範圍估計 (Estimated Range)**：根據目前為止的行動，推測對手可能持有的手牌組合有哪些（例如強價值、中等對子、聽牌、空氣牌的比例）。
3. **🎯 實戰剝削策略 (Explosive Advice)**：在 GTO 的基礎上，如何針對該對手的弱點或心理漏洞進行「剝削性調整」？如果我們過牌/下注/加注，他會有什麼樣的反應？

字數請控制在 400-600 字之間，條理清晰、排版優美。`;

      let prompt = "";
      if (message) {
        // If it's a follow-up chat message
        prompt = `基於上述戰局脈絡：\n${context}\n\n玩家詢問了以下後續問題：\n「${message}」\n\n請根據你身為高階撲克教練的專業進行解答，並保持繁體中文。`;
      } else {
        // If it's the initial analysis request
        prompt = `請對以下戰局進行全面的對手心態與範圍分析：\n${context}`;
      }

      // We'll prepare chat history if any exists for interactive follow-ups
      const contents = [];
      for (const hist of history) {
        contents.push({
          role: hist.role === 'user' ? 'user' : 'model',
          parts: [{ text: hist.text }]
        });
      }
      contents.push({
        role: 'user',
        parts: [{ text: prompt }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      res.json({
        analysis: response.text || "無法生成分析，請重試。"
      });

    } catch (error: any) {
      console.error("Gemini API Error in backend:", error);
      res.status(500).json({
        error: "GEMINI_API_ERROR",
        message: error?.message || "Gemini API 呼叫失敗，請稍後再試。"
      });
    }
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
