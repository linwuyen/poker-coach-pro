# ♠️ 想高龍了 德撲訓練機

**v6 Closed-loop Decision Tutor · Strategy Engine v2**

繁體中文德州撲克決策學習系統。目標不是把「刷題數」做大，而是建立可追溯的改善閉環：

> 真實牌局 exposure → 找高價值漏點 → 教學 / Solver transfer → 延遲提取 → Holdout → 回到真實牌局驗證

線上版本：**https://linwuyen.github.io/poker-coach-pro/**

## 現在的 production baseline

- Production source：`main`
- Web：GitHub Pages / PWA
- Runtime：Node.js 24+ / npm 11
- History：schema **v6**，自動讀取並遷移 v5/v4/v3/v2
- Teaching bank：**152 個 genuine decision families**
  - 88 個原始人工 curated families
  - 64 個 P6 exact-math semantic families
- Cosmetic retrieval instances：64 個 suit-isomorphic variants
- Production scenario instances：**216**
- P2 generated isomorphic transfer pool：528 nodes，全部共享 canonical mastery family，不膨脹知識節點
- PokerBench pinned corpus：1,000 Preflop + 10,000 Postflop solver-labelled rows

## P0 → P8 已完成能力

### P0 — 隨機但不亂選

Daily planner 保留 Expected Learning Value / spaced review，加入 weighted sampling、recent-family repeat penalty、上一題首題迴避與 profile anchor。到期複習永遠不為了「看起來隨機」被丟掉。

### P1 — Progressive disclosure 教學

V12 主教學流程：

1. Confidence
2. Action
3. 10 秒懂
4. Why / conceptual error
5. Transfer / boundary check
6. Advanced evidence 按需展開

V11 保留可 rollback。

### P2 — 安全 transfer variants

Suit-isomorphism 只改花色身份，不改 strategic truth。這些題是 retrieval instance，不是新的 knowledge node。

### P3 — 真正 semantic counterfactual + canonical mastery

- `decisionFamilyId` 把 concrete question instance 與 knowledge node 分離。
- 舊 `teach-*-iso-*` / `gen-*-iso-*` history 會收斂回 canonical family。
- PokerBench semantic pairs 只有在**一個可觀測語義維度改變且 solver label 真正翻轉**時才成立。
- A/B 都鎖定後才 reveal，避免第一題答案污染第二題。

### P4 — Solver-backed Daily curriculum

Today 的主流程：

> Curated repair → Semantic counterfactual → Unseen solver generalization

PokerBench Training / Sibling / Holdout 分區保持隔離；Daily 只使用 Training partition。Solver corpus 無法載入時，降級為完整 curated plan，不以 heuristic 冒充 solver。

### P5-A — Real Hand History ingestion

支援貼上或載入 PokerStars / GGPoker text hand histories：

- Hand ID / source
- Cash / MTT
- blinds / table size
- Hero / seat / position / stack BB
- street / actions / action depth
- board
- real spot exposure frequency
- duplicate hand-id protection

匯入後寫成 `trainingType: real-hand` 的 v6 evidence。**純 hand history 只證明 exposure 與實際動作；沒有 solver/exact regret 時，不會自行判斷你打錯，也不會製造 EV loss。**

入口：`#hand-history`

### P5-B — Full Solver Surface import

Strategy Engine 可匯入 immutable solver surface JSON：

- action frequencies
- mixed strategy
- optional per-action EV
- action sizes
- solver name / version / reference / generatedAt
- content hash + immutable `id@version`

有 frequency 才算 Strategy Distance；有真實 per-action EV 才算 EV regret。PokerBench 公開資料只有 optimal decision labels，因此仍不會被當成完整 EV surface。

入口：`#strategy-surface`

### P5-C — Learning effectiveness

固定 Baseline / Training / Follow-up 時窗，比較：

- Holdout accuracy
- Transfer accuracy
- Delayed retention
- 已驗證的 real-game frequency-weighted cash leak

報表永遠標記為 **observational before/after evidence**；不是隨機對照試驗，不把相關性冒充因果。

入口：`#effectiveness`

### P5-D — Real Chrome E2E

CI 除了 TypeScript / validation / unit tests / production build，還會啟動 production Vite preview 與真正 headless Chrome，透過 Chrome DevTools Protocol 執行：

> 開頁 → HH importer → controlled textarea input → 匯入 → History v6 localStorage assertion

不額外加入 Playwright/Cypress 依賴。

### P6 — 64 個真正 semantic exact-math families

新增 32 個 Pot Odds Call/Fold 邊界 + 32 個 Pure Bluff break-even 邊界。每題答案都可從題目給定的 pot / call cost / equity / fold rate 重新算出，不是把舊答案貼到改過的 stack/position/board 上。

因此現在是 **152 個 genuine decision families**，而非「88 題 + 64 換花色」假裝 152 個概念。

### P7 — Population exploit evidence database

Heuristic archetype overlay 與 population evidence 分離。

只有外部匯入 profile 同時具備：

- reference
- methodology
- population label
- generatedAt
- **sampleSize ≥ 1,000**
- explicit exploit ranges

才能標成 `population-exploit`。否則維持 `heuristic-estimate`。若 population profile 帶 EV，還必須額外聲明 EV methodology。

入口：`#exploit-workbench`

### P8 — Finite Game Simulation

FGS 使用**明確提供的未來 state tree**：

- 每個 child edge 必須有 probability
- 同一父節點的 probability 必須加總為 1
- eliminated player 仍以 stack 0 留在 state
- 每個 leaf 跑 exact ICM
- 再依 branch probabilities backward induction
- 可比較多個 action trees 的 Hero $EV

系統不自行猜未來對手 action frequency；結果的語義是：

> **conditional on the supplied future game tree**

入口：`#fgs-workbench`

## Truth hierarchy

```text
verified-solver
  > exact-math
  > population-exploit
  > expert-baseline
  > derived-interpolation
  > heuristic-estimate
```

資料可信度是產品契約：缺資料時顯示 unavailable / unsupported，而不是補一個漂亮但不存在的數字。

更完整的資料邊界見 [`docs/DATA_TRUST_CONTRACT.md`](docs/DATA_TRUST_CONTRACT.md)。閉環架構見 [`docs/CLOSED_LOOP_ARCHITECTURE.md`](docs/CLOSED_LOOP_ARCHITECTURE.md)。

## Tournament models

- ICM：exact recursive payout equity
- PKO：ICM + 可立即取得的 bounty EV
- Satellite：等值席位 payout
- FGS：explicit finite future-state tree + exact ICM leaves

FGS 不等於「自動求出 Nash future game tree」。未來 branch probability / state transition 必須由使用者、外部 simulator 或其他可追溯模型提供。

## 品質閘門

```bash
npm ci
npm run audit        # high 以上 vulnerability 不接受
npm run lint         # tsc --noEmit
npm run validate     # production scenario + range contracts
npm test             # learning / solver / HH / FGS / scheduler / strategy tests
npm run check        # lint + validate + test
npm run build:web    # production GitHub Pages build
npm run e2e:browser  # real Chrome production smoke
npm run build        # web + Node server bundle
```

Pull Request 必須先通過 GitHub Actions。正式部署只有一條路：

> merge `main` → validate / test / build → GitHub Pages

## 本地開發

```bash
npm ci
npm run dev
```

`start.bat` 可用於 Windows 本地啟動。

## 資料與隱私

- Training history / imported HH-derived evidence 預設存在瀏覽器 localStorage。
- JSON backup 支援完整匯出 / 匯入。
- 遠端同步若啟用，仍使用使用者自己的 HTTPS endpoint 與既有 AES-GCM 流程。
- Hand History parser 不會把原始 HH 自動上傳到第三方服務。

## AI 分析

GitHub Pages 主訓練不需要 API key。Gemini server mode 僅在本地 Node server `/api` 使用，key 留在 server environment，不進前端 bundle。
