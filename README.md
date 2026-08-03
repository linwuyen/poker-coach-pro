# ♠️ Poker Coach Pro (德州撲克戰術教練)

繁體中文德州撲克決策訓練器，包含 88 個精選情境、分支多街題、GTO 翻前範圍練習、錯題間隔複習、弱點診斷、離線教練與選用的 Gemini 線上 AI 分析。

---

## 🌐 線上直接玩 (GitHub Pages)

無需安裝任何軟體，開啟瀏覽器即可直接遊玩：
👉 **[https://linwuyen.github.io/poker-coach-pro/](https://linwuyen.github.io/poker-coach-pro/)**

> 💡 **提示**：線上版本支援 PWA，可將網頁「安裝」至手機或電腦桌面離線開啟使用。

---

## 💻 本地電腦啟動方式 (Local Development)

### 方式一：雙擊啟動 (Windows 推薦)
1. 確保電腦已安裝 [Node.js](https://nodejs.org/)。
2. 雙擊專案目錄下的 **`start.bat`**。
3. 首次執行會自動安裝套件並啟動伺服器，自動開啟瀏覽器前往 `http://localhost:3000`。
4. 關閉跳出的啟動視窗即可關閉伺服器。

### 方式二：指令啟動 (Terminal)
```bash
# 1. 安裝依賴套件
npm install

# 2. 啟動開發伺服器
npm run dev
```

---

## 🚀 重新部署與更新線上版本 (Deployment)

若未來修改了程式碼或題庫，想要更新 GitHub Pages 線上版，只需執行：

```bash
# 1. 提交程式碼變更
git add .
git commit -m "feat: 更新內容"
git push origin main

# 2. 一鍵打包並發布至 GitHub Pages
npm run deploy
```

---

## ⚙️ AI 牌局分析模式說明

專案支援兩種牌局分析模式：

1. **離線教練模式 (預設)**：不需要任何設定或 API Key，系統會根據內建牌局演算法自動生成詳細的心理、範圍與尺寸分析。
2. **Gemini 線上 AI 模式**：
   - 複製 `.env.example` 為 `.env`
   - 填入您的 Gemini API Key：
     ```dotenv
     GEMINI_API_KEY=YOUR_GEMINI_API_KEY
     GEMINI_MODEL=gemini-3.5-flash
     PORT=3000
     ```

---

## 🛠 開發與測試指令

```bash
npm run validate  # 題庫資料契約與衝突檢查 (檢查 88 個情境)
npm test          # 執行單元測試
npm run check     # 執行完整驗證 (TypeScript + Validate + Test)
npm run build     # 驗證並建立 Production 打包檔案 (dist)
```

---

## 💾 訓練資料與備份

* 系統會自動記錄訓練成績、思考時間與間隔複習排程。
* 支援在首頁「匯出/匯入 JSON 備份」，換電腦也能隨時轉移學習進度。
