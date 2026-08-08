# ♠️ 想高龍了 德撲訓練機

**v3 Decision Learning Engine · Strategy Engine v2.1**

繁體中文德州撲克決策學習系統。核心不是單純刷題，而是把每次決策轉成可追蹤的能力與 EV 成本：

> 牌局／訓練 → 決策 → EV Regret → Skill Graph → 延遲提取／Transfer → Expected Learning Value → 下一個最值得練的題目

## 🌐 線上版本

GitHub Pages：**https://linwuyen.github.io/poker-coach-pro/**

支援 PWA，可從瀏覽器安裝到桌面或手機。GitHub Pages 為靜態版本，因此不提供 `/api` 後端；需要伺服器端 Gemini 分析時請使用本地 server 模式。

## 🧠 v3 核心能力

- **Expected Learning Value Scheduler**：依弱點、遺忘風險、不確定性、transfer value、EV importance、玩家設定與時間成本排序每日訓練。
- **EV Regret**：以最佳行動 EV 與實際選擇 EV 的差值衡量錯誤成本，而不是只看答對／答錯。
- **Poker Skill Graph**：跨題追蹤 Preflop、Range、Math、Postflop、Tournament、Decision Boundary 等能力。
- **Transfer Mastery**：Mastered 需要穩定表現、延遲提取，以及 sibling／counterfactual transfer 證據。
- **Counterfactual Decision Boundary**：固定 range/equity，只改下注尺寸，找出 Call/Fold 決策反轉點。
- **Weighted Range Versus Hand**：建立加權 Villain range，再計算 Hero equity、Pot Odds、Call EV 與最佳動作。
- **ICM / $EV Workbench**：以 Independent Chip Model 計算 Fold $EV、Call $EV、break-even equity 與 risk premium。
- **Real-hand Feedback Loop**：真實牌局可標記為漏點並寫回個人 Skill Model，讓後續 Scheduler 優先安排相關 sibling drills。
- **EV Leak Graph**：依 EV loss 與 mastery 找真正最燒 BB 的能力缺口。
- **Strategy Engine v2.1**：策略 Profile 包含節點、位置、籌碼、Ante、Rake、下注樹、頻率、EV 與來源可信度。

## 🎯 策略資料可信度

策略資料會標示來源層級，例如 `verified-solver`、`expert-baseline`、`heuristic-estimate`。內建教學範圍是可審核的 baseline，不宣稱為特定 solver、抽水結構或錦標賽節點的精確 GTO 解；沒有對應節點時，查詢邏輯不應以其他情境冒充精確答案。

## 💻 本地開發

需求：**Node.js 24+、npm 11**。

```bash
npm ci
npm run dev
```

Windows 也可使用專案內的 `start.bat` 啟動本地環境。

## ✅ 品質與安全閘門

```bash
npm run audit      # high 以上依賴漏洞不可通過 CI
npm run lint       # TypeScript tsc --noEmit
npm run validate   # 88 個情境 + Range 題資料契約驗證
npm test           # Learning / Strategy / ICM / Scheduler 等單元測試
npm run check      # lint + validate + tests
npm run build:web  # GitHub Pages production build
npm run build      # web + Node server build
```

所有 Pull Request 都會經過 GitHub Actions 驗證；`main` 的成功建置才有資格發布正式網站。

## 🚀 部署

部署只有一條正式路徑：**push / merge 到 `main` → GitHub Actions 驗證與 build → 自動發布 `dist` 到 `gh-pages`**。

不需要也不應手動執行 `npm run deploy`。這樣可避免 `main` 與正式網站的 production branch 再次不同步。

## 💾 訓練資料

- History 使用 schema v4，新增欄位保持向下相容。
- 記錄 confidence、duration、review interval、unseen/delayed review、EV loss、skill IDs、transfer evidence 等資料。
- 支援 JSON 完整匯出／匯入與舊資料遷移。
- 選配遠端同步使用使用者自己的 HTTPS PUT/GET endpoint；資料先在瀏覽器以 AES-GCM 加密，密碼與 Bearer Token 不寫入 localStorage。

## 🤖 AI 分析

- **離線教練**：GitHub Pages 可直接使用，不需 API Key。
- **Gemini server 模式**：本地啟動 server 後可透過 `/api` 使用；API Key 應只存在伺服器環境變數，不應打包進前端。

## 🏗️ Production baseline

- App version: `3.0.0`
- Runtime baseline: Node 24 / npm 11
- Production source: `main`
- GitHub Pages artifact branch: `gh-pages`
- Web base path: `/poker-coach-pro/`
