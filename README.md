# ♠️ 想高龍了 德撲訓練機

**History v6 · Closed-loop Decision Tutor · Strategy Engine v2/v3 · P0→P12**

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
- Preflop full truth：外部 immutable **Strategy Profile v2** surfaces
- Postflop full truth：外部 immutable **Postflop Truth Pack v3** nodes
- coverage 只依實際匯入的 verified solver data 計算；repo 不宣稱內建完整 EV database

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

### P9 · Truth automation

- **P9-A Solver coverage**：對已匯入 v2 profiles 建 verified coverage index；auto grading 嚴格 exact-match，0 或多個 exact versions 都是 Unknown。
- **P9-B Population cohort registry**：保存 site/stake/window/sample/raw numerator-denominator/provenance；`id@version` immutable。
- **P9-C HH → Truth → Leak → Daily**：Preflop exact v2 join + sourced per-action EV 才寫 regret；verified real-game regret 只提升 Training priority，不碰 Sibling/Holdout。
- **P9-D Tournament Context**：HH 以 handId join explicit ICM/PKO/FGS state；不猜 payout、stack、bounty、equity 或 branch probability。
- **P9-E Reviewed explanations**：human-reviewed explanation registry 與 raw solver truth 分離。

### P10 · Preregistered Randomized N-of-1

入口：`#experiment`

- balanced deterministic random block assignment
- preregistration 必須早於第一 block
- explicit primary metric
- block-start washout
- 每個 arm 至少兩個有 evidence blocks
- minimum sample gate
- 支援 holdout accuracy / transfer accuracy / delayed retention / verified real-game EV loss

不足門檻顯示 `Insufficient`，不選 winner。通過時只宣稱這位玩家在這個 preregistered randomized N-of-1 experiment 中的比較，不外推成 population-wide causal claim。

### P11 · Browser E2E + Performance Hardening

- heavyweight labs 使用 route-level `React.lazy` chunks。
- 真 Chrome production smoke 走 critical routes。
- vendor chunk splitting + Vite manifest。
- CI 有 **500 KiB minified JS chunk hard budget**；超標直接 fail。

### P12-A · Postflop Strategy Context v3

入口：`#postflop-truth`

Strategy Engine v3 專門表示 Flop / Turn / River exact heads-up state：

- exact board
- Hero / Villain position
- effective stack
- pot BB / SPR / to-call
- canonical preflop line
- 當街 action line + bet/raise pot fraction
- last aggressor
- cash rake / rake cap
- exact Hero hole-card combo

Automatic truth lookup **沒有 approximate fallback**。Multiway 不會被硬塞進 heads-up solver node。

### P12-B · Postflop Truth Pack v3

v3 importer 支援 immutable solver truth pack：

- solver name/version/reference/generatedAt
- per-combo action frequencies
- mixed strategy
- optional per-action EV
- optional action-size surface
- content hash + `id@version` immutability
- Flop / Turn / River coverage report

這完成的是大量 solver truth 的 ingestion/index/matching 能力；**沒有可信公開資料時不會在 repo 內生成假的完整 solver database**。

### P12-C · HH → Postflop Solver → Regret → Daily

入口：`#hand-history`

HH replay 會重建每個 Hero postflop decision **發生前**的：

> pot → street commitments → remaining stack → active players → board → preflop line → street line → to-call → SPR

只有以下全部成立才寫 `verified-solver` regret：

1. heads-up postflop state；
2. 唯一 exact v3 node；
3. exact Hero combo 存在；
4. chosen action 有真實 EV；
5. 至少一個 comparison action EV 存在。

否則只保留 raw HH exposure。產生的 Flop/Turn/River regret 會沿用既有 Daily situation-level routing，仍只影響 PokerBench Training partition。

### P12-D · Measured Local Population Dataset

每批真實 HH 會把 postflop action opportunities 聚合成：

- street
- facing state
- action
- raw numerator
- raw denominator
- measured rate
- sample hands / decision opportunities
- source hand-id hash

這些資料標成 **`measured-local-cohort`**。它證明「觀察到什麼」，不自動宣稱「這就是 exploit 策略」，也不直接升級成 `population-exploit`。

### P12-E · Tournament Context Reconstruction

入口：`#postflop-truth` + `#hand-history`

新增 tournament metadata registry：一次提供 tournament-level payout vector、utility unit、reference/methodology，以及每個 handId 的 **full-field stack snapshot**。之後 MTT HH 可用 tournamentId + handId 自動 join：

- HH 可自動證明的 table players / Hero / hand ID 直接抽取
- full field / payouts 從 metadata registry 接上
- 缺資料會列出 missing fields
- **table stacks 永遠不會被偷偷當成整場比賽的 full field**

這層降低每手手動 JSON 的負擔；ICM/PKO/FGS 的 showdown equity / bounty / future probabilities 等 decision-specific inputs 仍必須來自明確可追溯來源。

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
- v3 Postflop auto-grading 目前故意限制在 heads-up exact state。
- Local population HH cohort 是 measured observation，不等於 population exploit truth。
- Tournament payout/full-field state/FGS probability 不從普通 HH 猜。
- Reviewed explanation 是 human interpretation，不是 raw solver rationale。

完整邊界：[`docs/DATA_TRUST_CONTRACT.md`](docs/DATA_TRUST_CONTRACT.md)  
閉環架構：[`docs/CLOSED_LOOP_ARCHITECTURE.md`](docs/CLOSED_LOOP_ARCHITECTURE.md)

## 主要入口

```text
#hand-history          HH exposure + Preflop v2 / Postflop v3 strict grading
#postflop-truth        P12 v3 solver truth + tournament metadata + local cohort status
#truth-ops             v2 solver coverage / population cohort / reviewed explanation
#strategy-surface      Strategy Profile v2 inspection/import
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
npm run audit
npm run lint
npm run validate
npm test
npm run check
npm run build:web
npm run check:bundle
npm run e2e:browser
npm run build
```

PR merge 前必須讓最新 head 的 GitHub Actions 全綠。

## 資料與隱私

- Training history / HH-derived evidence / imported truth registries 預設存在瀏覽器 localStorage。
- 原始 HH 不會自動上傳第三方。
- measured-local-cohort 保存 aggregate counts + hand-id hash，不把它冒充公開 population dataset。
- JSON backup 支援 History 匯出/匯入；既有遠端同步仍使用使用者自己的 HTTPS endpoint 與 AES-GCM 流程。
- GitHub Pages 主訓練不需要 API key；Gemini server mode 的 key 僅留在 server environment。
