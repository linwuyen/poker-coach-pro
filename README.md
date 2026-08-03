# Poker Coach Pro

繁體中文德州撲克決策訓練器，包含 88 個情境、分支多街題、GTO 翻前範圍練習、錯題間隔複習、弱點診斷、離線教練與選用的 Gemini 線上分析。

## Windows 快速啟動

安裝 [Node.js](https://nodejs.org/) 後雙擊 `start.bat`。第一次會自動安裝套件，之後開啟 `http://localhost:3000`。關閉啟動視窗即可停止由它啟動的伺服器。

## 開發

```bash
npm install
npm run dev
```

常用檢查：

```bash
npm run validate  # 題庫資料契約與撞牌檢查
npm test          # 自動測試
npm run check     # 型別、題庫與測試
npm run build     # 驗證後建立 production bundle
```

## 環境設定

複製 `.env.example` 為 `.env`。離線模式不需要 API key；只有線上 AI 分析需要 `GEMINI_API_KEY`。

```dotenv
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
PORT=3000
```

`APP_URL` 用於公開部署的 CORS allowlist。`PORT` 改動後，`start.bat` 也會讀取相同設定。

## 訓練資料

瀏覽器會自動把舊版 `poker_training_history_v2` 遷移到 v3。首頁可匯出或匯入 JSON 備份。v3 紀錄包含題目步驟、所選動作、最佳動作、街道、位置、思考時間與複習排程。

題庫的策略解說是教學假設，不代表求解器唯一頻率。新增題目時請填寫 `assumptions` 與 `strategySource`，並執行 `npm run validate`。

## PWA

Production build 會註冊 service worker，可從支援的瀏覽器安裝。靜態介面與既有快取可離線開啟；Gemini 線上分析仍需要網路。
