# ♠️ 想高龍了 德撲訓練機

**v4 Truth & Transfer Engine · Strategy Engine v2.1**

繁體中文德州撲克決策學習系統。核心目標不是刷題數，而是用最少訓練時間降低未來實戰決策的 EV loss：

> Strategy Truth → 決策 → EV Regret × Spot Frequency → Skill / Situation Graph → 延遲提取／Transfer → 下一個最高價值訓練

## 🌐 線上版本

GitHub Pages：**https://linwuyen.github.io/poker-coach-pro/**

支援 PWA，可從瀏覽器安裝到桌面或手機。GitHub Pages 為靜態版本，因此不提供 `/api` 後端；需要伺服器端 Gemini 分析時請使用本地 server 模式。

## 🧠 v4 核心能力

- **Exact / Monte Carlo Equity Engine**：支援 weighted range、blocker、5-of-7 Hold'em hand evaluator；小型狀態空間完整枚舉，大型狀態空間使用 deterministic seeded Monte Carlo。
- **EV × Spot Frequency Scheduler**：Expected Learning Value 不只看弱點，也把每次 EV regret 與該類 spot 的實戰出現頻率納入優先級。
- **Hidden Holdout Benchmark**：正式 holdout 題與 daily、一般 review、專項訓練隔離，降低「背過題目卻以為學會」的假象。
- **Counterfactual Decision Boundary v2**：一次只改下注尺寸或 Villain range composition，觀察 Equity、Pot Odds 與 Call/Fold 反轉點。
- **Bet Size as Action**：Check、25%、33%、50%、66%、80%、125% 等尺寸可以是不同 action，分別記錄 chosen EV、best EV 與 regret。
- **Theory ↔ Exploit Workbench**：理論 baseline 與對 Nit/TAG/LAG/Calling Station 的 exploit overlay 分開呈現；沒有 population sample 時 exploit 永遠不冒充實證真值。
- **Truth Hierarchy**：`verified-solver > exact-math > population-exploit > expert-baseline > derived-interpolation > heuristic-estimate`。
- **Skill + Situation Graph**：除了能力，也追蹤 Position、Stack、Pot Type、Street、Bet Size 與 Board Texture，找出真正燒 BB 的局面。
- **Prescription Analytics**：從描述型 Dashboard 升級成 7 天 repair → delayed recall → transfer → hidden holdout 處方。
- **North Star**：追蹤近 30 天 frequency-weighted EV leak、前一周期比較與 Hidden Benchmark 表現，而不是只看總正確率。
- **Tournament $EV Workbench**：ICM、PKO bounty EV、Satellite 等值席位分開計算；FGS 需要未來 game tree，系統明確不假裝已支援。
- **Weighted Range Versus Hand**：建立加權 Villain range，再計算 Hero Equity、Pot Odds、Call EV 與最佳動作。
- **Strategy Engine v2.1**：Profile 保存節點、位置、籌碼、Ante、Rake、下注樹、頻率、EV、來源與 immutable version。

## ✨ v4 視覺系統

介面加入低干擾動態效果：

- ambient gradient glow + subtle grid depth
- card hover lift / state transition
- primary CTA 低頻 shimmer
- Hero panel soft pulse
- 頁面進場 transition

所有動畫都遵守 `prefers-reduced-motion`；目的在增加層次與回饋感，不做賭場式持續閃爍。

## 🎯 策略資料可信度

資料可信度是產品的一部分，不是註腳。Solver、Exact Math、Population Evidence、Expert Baseline、Derived 與 Heuristic 分層呈現。內建 teaching range / sizing EV 不宣稱為特定 solver 的精確輸出；沒有完全匹配的策略節點時，查詢層應回 `unsupported` 或清楚標示 approximate。

Exploit overlay 目前是透明的教學規則，`trustTier` 固定為 `heuristic-estimate`；只有未來真的匯入具有樣本數與來源的 population profile 時，才能升級成 `population-exploit`。

## 🧪 Benchmark 原則

一般「未見題探索」屬於 training pool；真正 **Hidden Benchmark** 使用獨立穩定分池：

- 不進 daily planner
- 不進一般專項訓練
- 不進 normal due-review
- 只在 Hidden Benchmark 入口作答
- 結果獨立寫成 `trainingType: benchmark`

小型測試題庫不會被硬切 holdout；只有足夠大的題庫或題目明確標示 `benchmarkRole: holdout` 才啟用。

## 🏆 Tournament 模型邊界

- **ICM**：Independent Chip Model，處理獎金結構與 risk premium。
- **PKO**：在 ICM 基礎上加入可立即取得的 bounty EV；只有 Hero covers 並能實際淘汰 Villain 才計入。
- **Satellite**：把晉級席位建模為等值票券 payout。
- **FGS**：尚未實作；需要完整未來牌局樹，不使用簡化公式冒充。

## 🃏 真實牌局資料

現有的**手動自訂牌局實驗室**仍可把一手牌標成個人漏點寫入 Skill Model。

v4 **刻意沒有加入 Poker Hand History 自動匯入器**。也就是不解析 PokerStars/GG/其他平台 hand-history 檔案，不建立自動實戰資料 ingestion pipeline。

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
npm run validate   # 88 個情境 + 6 個 Range 題資料契約
npm test           # Equity / Learning / Strategy / ICM / PKO / Benchmark / Scheduler
npm run check      # lint + validate + tests
npm run build:web  # GitHub Pages production build
npm run build      # web + Node server build
```

所有 Pull Request 都必須通過 GitHub Actions；`main` 成功建置後才發布正式網站。

## 🚀 部署

唯一正式路徑：**push / merge 到 `main` → GitHub Actions audit / validate / test / build → 自動發布 `dist` 到 `gh-pages`**。

不使用第二套手動部署流程，避免 `main` 與線上 production bundle 不一致。

## 💾 訓練資料

- History schema 維持 v4，新增欄位皆為 optional，以保持舊資料相容。
- 可記錄 confidence、duration、review interval、unseen/delayed review、chosen/best EV、EV loss、skill IDs、situation IDs、transfer evidence、bet-size action 與 spot-frequency prior。
- 支援 JSON 完整匯出／匯入與舊資料遷移。
- 選配遠端同步使用使用者自己的 HTTPS PUT/GET endpoint；資料先在瀏覽器以 AES-GCM 加密，密碼與 Bearer Token 不寫入 localStorage。

## 🤖 AI 分析

- **離線教練**：GitHub Pages 可直接使用，不需 API Key。
- **Gemini server 模式**：本地 server 透過 `/api` 使用；API Key 僅存在伺服器環境變數，不打包進前端。

## 🏗️ Production baseline

- App version: `4.0.0`
- Runtime baseline: Node 24 / npm 11
- Production source: `main`
- GitHub Pages artifact branch: `gh-pages`
- Web base path: `/poker-coach-pro/`
