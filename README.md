# ♠️ 想高龍了 德撲訓練機

**History v6 · Closed-loop Decision Tutor · Strategy Engine v2 · P0→P11**

繁體中文德州撲克決策學習系統。North star 不是刷題數，而是降低未來 decision loss：

> 真實牌局 exposure → exact truth join → 找高價值漏點 → 教學 / Solver transfer → 延遲提取 → Holdout → randomized N-of-1 / 實戰再驗證

線上版本：**https://linwuyen.github.io/poker-coach-pro/**

## Production baseline

- Production source：`main`
- Web：GitHub Pages / PWA
- Runtime：Node.js 24+ / npm 11
- History：schema **v6**，讀取並遷移 v5/v4/v3/v2
- Teaching bank：**152 genuine decision families**
  - 88 原始人工 curated families
  - 64 P6 exact-math semantic families
- Cosmetic retrieval：64 suit-isomorphic instances
- Production scenario instances：**216**
- P2 generated isomorphic transfer pool：528 nodes，共享 canonical mastery family
- PokerBench pinned corpus：1,000 Preflop + 10,000 Postflop solver-labelled rows
- Full solver truth：**外部 immutable Strategy Profile v2 surfaces**；coverage 依實際已匯入 verified data 計算，不宣稱 repo 內建完整 EV database

## 已完成能力

### P0–P4 · 教學、隨機化、transfer、canonical mastery、Solver Daily

- Daily：Expected Learning Value + spaced review + weighted sampling + repeat penalty + profile anchor。
- V12 progressive disclosure：Confidence → Action → 10 秒懂 → Why → Transfer/Boundary → Advanced evidence。
- Suit-isomorphism 只當 retrieval instance，不膨脹 knowledge node。
- PokerBench semantic counterfactual 只有在單一可觀測維度改變且 solver label 翻轉時成立。
- Daily 預設：Curated repair → semantic counterfactual → unseen solver generalization。
- PokerBench Training / Sibling / Holdout 分區隔離；Daily 永不使用 Sibling/Holdout。

### P5–P8 · Closed-loop data foundation

- **P5-A HH ingestion**：PokerStars / GGPoker text HH → hand/source/format/blinds/table/Hero/position/stack/street/actions/board/exposure；duplicate hand ID 防重複。Raw HH 本身不判 GTO。
- **P5-B Full Solver Surface**：immutable Strategy Profile v2，支援 action frequencies、mixed strategy、optional per-action EV、action sizes、solver provenance/content hash。沒有 EV 就不算 EV regret。
- **P5-C Effectiveness**：Baseline / Training / Follow-up observational report，分離 holdout、transfer、delayed retention、verified real-game leak。
- **P5-D Real Chrome E2E**：production build + headless Chrome + CDP，不額外依賴 Playwright/Cypress。
- **P6 Semantic teaching bank**：64 個可重算 exact-math decision-boundary families，讓 genuine families 總數到 152。
- **P7 Population exploit profile**：只有 provenance + methodology + population + generatedAt + sampleSize≥1000 + explicit exploit range 才能標 `population-exploit`。
- **P8 FGS**：explicit finite future-state tree + exact ICM leaves + probability-weighted backward induction；不自行猜 future action probability。

### P9-A · Full Solver Truth Coverage

入口：`#truth-ops`、`#strategy-surface`

- 對已匯入 profiles 建立 verified coverage index：contexts / frequency hands / mixed hands / EV hands / full per-action-EV hands。
- 自動 real-game grading 使用比互動查詢更嚴格的 matcher：format / table / spot / Hero/Villain position / stack / ante / open size / rake / cap / ICM model 必須完整 exact-match。
- 只有 `verified-solver` 且 chosen action 真有 per-action EV 時才產生 reportable regret。
- **這完成的是 full-truth ingestion/index/matching 能力，不是憑空附送一份完整 solver database。**

### P9-B · Real Population Cohort Registry

入口：`#truth-ops`

Population cohort 會保存：

- site / stake / game / table size / named population
- observedFrom / observedTo / generatedAt
- sampleSize / reference / methodology
- 每個 metric 的 raw numerator / denominator / rate
- 可選 linked exploit profile keys

`id@version` immutable；rate 必須和 numerator/denominator 一致。只有「72%」沒有 raw counts/provenance 的漂亮數字不算 evidence-backed cohort。

### P9-C · HH → Truth → Leak → Daily

入口：`#hand-history`

1. Raw HH 先照常寫 exposure evidence。
2. Preflop decision 只有在唯一 exact verified Strategy Profile v2 node 對上時才進 grading。
3. Chosen action 必須有真實 per-action EV 才寫 `evLossBB`。
4. Verified real-game regret 會提升相同 position/street 的 PokerBench **Training** priority。
5. 這只是 situation-level routing，不宣稱 PokerBench row 等於外部 solver node；Sibling/Holdout 完全不變。

目前 automated HH→solver grading 明確只涵蓋 Strategy Engine v2 能完整表達的 **preflop nodes**。Postflop board/action tree 尚未有等價完整 context model，因此保持 Unsupported，不拿 preflop truth 硬套。

Cash solver profile 若有 rake/rake-cap 維度，HH 匯入頁必須由使用者明確提供，留白就不允許 exact grading。

### P9-D · Tournament HH → ICM / PKO / FGS

入口：`#tournament-context`

一般 MTT HH 只當 `handId` join key。Tournament Context Envelope 必須另外明確提供：

- all player IDs / stacks
- payouts + utility unit
- Hero / chosen action
- ICM/PKO：villain、amount at risk、showdown equity；PKO 再提供 bounty
- FGS：完整 action trees + 每條 branch probability
- reference / methodology / generatedAt

輸出寫成 `exact-math` tournament utility evidence。結果語義永遠是 **conditional on supplied tournament state/tree**。

### P9-E · Human-reviewed Solver Teaching

入口：`#truth-ops`

Reviewed Explanation Registry 和 solver truth 分開：

- target decisionFamily 或 profile+hand
- why
- explicit boundary conditions
- common mistake
- contrastive cue
- author / reviewer(s) / reviewedAt / reference / version

沒有 review provenance 的文字不能進 registry；human interpretation 不會被標成 raw solver output。

### P10 · Preregistered Randomized N-of-1

入口：`#experiment`

- balanced deterministic random block assignment
- preregistration 必須早於第一 block
- explicit primary metric
- block-start washout
- 每個 arm 至少兩個有 evidence blocks
- minimum sample gate
- 支援 holdout accuracy / transfer accuracy / delayed retention / verified real-game EV loss

不足門檻顯示 `Insufficient`，不選 winner。通過時只宣稱「這位玩家在這個 preregistered randomized N-of-1 experiment 中」的比較，不外推成 population-wide causal claim。

### P11 · Browser E2E + Performance Hardening

- 所有 heavyweight labs 改為 route-level `React.lazy` chunks，避免首屏把 solver/analysis/tournament 全部載入同一 bundle。
- Real Chrome production smoke 現在走完整 critical journey：

> Today → HH controlled input + History v6 persistence → Truth Ops → Solver Surface → Effectiveness → Tournament Join → FGS → randomized N-of-1 persistence → Today

Lazy chunk 本身載不進來就會直接讓 E2E 失敗。

## Truth hierarchy

```text
verified-solver
  > exact-math
  > population-exploit
  > expert-baseline
  > derived-interpolation
  > heuristic-estimate
```

核心規則：**fail toward Unknown, not fabricated precision**。

- PokerBench 公開資料是 optimal decision labels，不是完整 mixed-frequency/per-action-EV surface。
- Raw HH 是 observation，不是 solver truth。
- Population rate 沒有 provenance/raw counts 不升級。
- Tournament payout/state/FGS probability 不從普通 HH 猜。
- Reviewed explanation 是 human interpretation，不是 raw solver rationale。

完整邊界：[`docs/DATA_TRUST_CONTRACT.md`](docs/DATA_TRUST_CONTRACT.md)  
閉環架構：[`docs/CLOSED_LOOP_ARCHITECTURE.md`](docs/CLOSED_LOOP_ARCHITECTURE.md)

## 主要入口

```text
#hand-history          HH exposure + strict verified leak grading
#truth-ops             solver coverage / population cohort / reviewed explanation
#strategy-surface      full Strategy Profile v2 inspection/import
#solver-corpus         PokerBench training corpus
#semantic-counterfactual
#effectiveness         observational before/training/follow-up
#experiment            preregistered randomized N-of-1
#tournament-context    HH ↔ explicit ICM/PKO/FGS state join
#icm-workbench
#fgs-workbench
#exploit-workbench
```

## 品質閘門

```bash
npm ci
npm run audit        # high+ vulnerability 不接受
npm run lint         # tsc --noEmit
npm run validate     # scenario + range contracts
npm test             # learning / solver / HH / population / tournament / experiment / scheduler tests
npm run check        # lint + validate + test
npm run build:web    # production GitHub Pages build + lazy chunks
npm run e2e:browser  # real Chrome critical-route smoke
npm run build        # web + Node server bundle
```

PR merge 前必須讓最新 head 的 GitHub Actions 全綠。

## 本地開發

```bash
npm ci
npm run dev
```

`start.bat` 可用於 Windows 本地啟動。

## 資料與隱私

- Training history / HH-derived evidence / imported truth registries 預設存在瀏覽器 localStorage。
- 原始 HH 不會自動上傳第三方。
- JSON backup 支援完整 History 匯出/匯入；既有遠端同步仍使用使用者自己的 HTTPS endpoint 與 AES-GCM 流程。
- GitHub Pages 主訓練不需要 API key；Gemini server mode 的 key 僅留在 server environment。
