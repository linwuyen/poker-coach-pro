# ♠️ 想高龍了 德撲訓練機

**History v6 · Closed-loop Decision Tutor · Strategy Engine v2/v3/v4 · P0→P23**

繁體中文德州撲克決策學習系統。North star 不是刷題數，而是降低未來 decision loss：

> 真實牌局 exposure → exact truth join → 找高價值漏點 → 教學 / Solver transfer → 延遲提取 → Holdout → randomized N-of-1 / 實戰再驗證

線上版本：**https://linwuyen.github.io/poker-coach-pro/**

## Production baseline

- Production source：`main`
- Web：GitHub Pages / PWA
- Runtime：Node.js 24+ / npm 11
- History：schema **v6**，讀取並遷移 v5/v4/v3/v2
- Teaching bank：**152 genuine decision families** + 64 cosmetic suit-isomorphic retrieval instances = **216 production scenarios**
- P2 generated isomorphic transfer pool：528 nodes，共享 canonical mastery family
- PokerBench pinned corpus：1,000 Preflop + 10,000 Postflop solver-labelled rows
- Preflop truth：外部 immutable **Strategy Profile v2**
- Heads-up postflop truth：外部 immutable **Postflop Truth Pack v3**
- Multiway postflop truth：外部 immutable **Multiway Truth Pack v4**
- coverage 只依實際匯入的 verified solver data；repo **不宣稱內建完整 EV database**

## P0–P17 已完成基礎

- **P0–P4**：Daily Expected Learning Value、spaced review、weighted sampling、progressive disclosure、canonical mastery、PokerBench semantic counterfactual、Training/Sibling/Holdout leakage guard。
- **P5–P8**：PokerStars/GGPoker HH、Strategy Profile v2 full surface、observational effectiveness、real Chrome E2E、64 exact-math semantic families、evidence-backed population profile、explicit FGS tree。
- **P9–P12**：solver coverage、population cohort、HH→truth→leak→Daily、reviewed explanation、randomized N-of-1、route lazy chunks/bundle budget、Strategy Engine v3 heads-up postflop、tournament reconstruction。
- **P13**：v3 IndexedDB/context index/pack manifests/NDJSON streaming、explicit solver CSV mapping、HH integrity guard、truth observability。
- **P14**：獨立 Strategy Engine v4；3-way+ 必須保存每個 active opponent position + remaining stack，v3 不 fallback 到 multiway。
- **P15**：full-field tournament lobby/snapshot ingestion + conservative tournament summary payout extraction。
- **P16**：train/holdout population deviation validation、Wilson 95% intervals、sample/practical-delta gate；deviation 不自動生成 exploit。
- **P17**：verified real-game regret longitudinal outcomes + leak-priority prescriptions；observational trend 不冒充 causal result。

## P18 · Real-world HH completeness + v4 scale parity

入口：`#hand-history`、`#evidence-ops`

P18 不再用「看到特殊字樣就全部封鎖」；它先問：**決策當下的 material geometry 能不能唯一重建？**

### P18-A · Straddle / dead blind

- non-standard forced bet 轉成 canonical `forcedBetKey = position + kind + BB amount`。
- straddle 是 live commitment：會影響 preflop to-call / pot。
- dead blind 是 dead money：進 pot，但不抵後續 call commitment。
- v2/v3/v4 exact context 都包含這個 optional key；特殊牌局永遠不會誤撞標準 solver node。
- marker 存在但位置/金額/類型不能證明 → `Unsupported`。

### P18-B · Side pot / all-in geometry

v4 multiway replay 在 active all-in 使 eligibility material 時，建立 canonical `potStructureKey`：

- contribution tiers
- main / side tier amount
- 每 tier eligible positions
- folded money保留在 pot amount，但 folded player 不具 eligibility

只有同一 pot-tier geometry 的 v4 truth 才能 exact grade。

### P18-C/D · Run-it-twice / cash-out

- 若 multiple runout / cash-out **只在所有 Hero 決策完成後**發生，settlement 不會反向污染先前 solver decision state，因此既有決策仍可 grading。
- 若 Hero 在 multiple-board / cash-out settlement 開始後仍有決策，目前仍 fail-closed。

### P18-E · v4 large-data parity

v4 truth store 現在與 v3 同級：

- IndexedDB nodes + context index
- context metadata
- pack manifests
- true nodeCount / skippedCount / contentBytes
- NDJSON streaming import
- cursor/paged node iteration
- deterministic memory fallback for tests

P18 同時修正 v3 NDJSON manifest：streaming pack 現在記錄實際 counts/bytes，不再把空 final batch 誤記成 0。

## P19 · Real Solver Truth Coverage

入口：`#evidence-ops`

Unified truth portfolio 同時檢視 v2 / v3 / v4：

- verified nodes
- unique exact contexts
- **unique usable combos**
- **full per-action-EV combos**
- ambiguous combos / overlapping versions
- source references
- IndexedDB pack manifests / approximate bytes

一個 combo 若同時被多個 exact truth versions 覆蓋，會算 `ambiguous`，**不算可自動 grading coverage**。

若需要「80% coverage」這種百分比，必須先匯入 versioned `TruthCoverageTargetEnvelope`，明確列出 target contexts、weight、minimum unique/full-EV combos。沒有 target universe 時只報實際 coverage，不製造分母。

## P20 · Tournament Range / Equity automation

入口：`#evidence-ops`、`#tournament-context`

`TournamentRangeEvidence` 要求：

- handId
- exact Hero cards / board
- explicit weighted villain range
- reference / generatedAt / methodology

系統使用既有 equity engine 重算：

- exact enumeration → `exact-eligible`，可補進 ICM/PKO `showdownEquity`
- seeded Monte Carlo → `simulation-only`，可重現但**不升級成 exact-math tournament utility**

FGS probability automation同樣只接受明確來源的 parent→child edge probabilities；每個 tree edge 必須完整覆蓋、每個 parent children sum=1。HH 本身不會被拿來猜 future branch probability。

## P21 · Population → exploit validation loop

入口：`#evidence-ops`

P21 把兩件事拆開：

1. P16：population deviation 是否在 independent holdout 重現？
2. P21：**一個外部已提供的 exploit candidate** 是否真的在另一組 paired holdout EV evidence 上改善 utility？

Candidate 必須：

- 已是 evidence-backed `population-exploit` Strategy Profile
- exact strategy context 相符
- 連到通過 P16 的 deviation
- paired candidate-minus-baseline utility deltas 有 provenance
- holdout ≥ 200 opportunities
- mean improvement ≥ declared practical threshold（default 0.01 BB/opportunity）
- 95% mean-delta interval lower bound > 0

通過才是 `validated-exploit`。系統**永遠不從「pool fold 太多」自行生成 bluff range**。

## P22 · P10 ↔ P17 causal learning loop

入口：`#experiment`、`#evidence-ops`

P17 告訴你「哪個 leak 值得修」，P10 randomized N-of-1 告訴你「對你本人哪個 intervention 比較有效」。P22 把兩者安全接起來：

- decision-family target 必須在 experiment preregistration 之前/當下登記
- experiment 必須真的通過 P10 sample/block/washout gates，得到 `randomized-n-of-1` + winning arm
- 只有 target family 的 prescription 會得到 `recommendedIntervention`
- 原本的 real-game leak priority 不被實驗改寫
- solver truth 不被實驗改寫
- claim 只限這位玩家的 preregistered randomized comparison，不外推 population

## P23 · Portable Truth Workspace

入口：`#evidence-ops`

大型 v3/v4 truth 不再依賴一般 JSON backup。P23 提供 NDJSON workspace：

```text
workspace header
v3/v4 pack manifests
v3 nodes (stream)
v4 nodes (stream)
workspace footer + counts
```

- export 透過 `iterateNodes()` streaming，不建立 combined node array。
- 支援 caller-owned writable stream；Chrome File System Access 可直接串流到檔案。
- import 建議先跑完整 `validateOnly`，再重開 file stream 做 additive restore。
- restore 永遠走 immutable node checks，不清空或覆寫現有 truth。
- footer counts 必須與實際 streamed records 一致；截斷/錯誤 workspace 不會被宣稱 valid。

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

- PokerBench 是 optimal decision labels，不是完整 mixed-frequency/per-action-EV surface。
- Raw HH 是 observation，不是 solver truth。
- straddle/dead-blind/side-pot 只有 material geometry 被 exact-key 表示後才允許相符 truth grading。
- post-decision run-it-twice/cash-out 不會污染較早決策；settlement 後仍有 decision 則 Unsupported。
- v3 是 exact heads-up；v4 是 exact multiway；兩者不互相做 approximate fallback。
- P19 coverage 沒有 explicit target universe 就沒有虛構百分比分母。
- Monte Carlo tournament equity 是 simulation evidence，不是 exact-math。
- P16 validated deviation 不生成 exploit；P21 只驗證外部 candidate。
- P17 observational trend 不冒充 causal；P22 只接受 preregistered P10 randomized evidence。

完整邊界：[`docs/DATA_TRUST_CONTRACT.md`](docs/DATA_TRUST_CONTRACT.md)  
閉環架構：[`docs/CLOSED_LOOP_ARCHITECTURE.md`](docs/CLOSED_LOOP_ARCHITECTURE.md)  
P18–P23：[`docs/REAL_WORLD_EVIDENCE_LOOP.md`](docs/REAL_WORLD_EVIDENCE_LOOP.md)

## 主要入口

```text
#hand-history          HH exposure + exact geometry audit + v2/v3/v4 strict grading
#postflop-truth        indexed v3 truth + legacy migration + explicit tournament metadata
#production-ops        P13–P17 scale/multiway/tournament/population/longitudinal operations
#evidence-ops          P18–P23 geometry/coverage/tournament/exploit/causal/workspace operations
#truth-ops             v2 solver coverage / population cohort / reviewed explanation
#strategy-surface      Strategy Profile v2 inspection/import
#solver-corpus         PokerBench training corpus
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

PR merge 前必須讓**最新 head**的 GitHub Actions 全綠。

## 資料與隱私

- Training history / HH-derived evidence / small metadata registries 預設在 browser local storage。
- v3/v4 大型 postflop truth 使用 browser IndexedDB。
- P23 workspace 讓大型 truth 可由使用者明確 export/import；不會自動上傳。
- 原始 HH 不會自動上傳第三方。
- measured-local-cohort 保存 aggregate counts + hand-id hash，不冒充公開 population dataset。
- 外部 solver / population data 的授權與 provenance 必須由匯入來源本身成立；repo 不製造缺失資料。
- 既有遠端同步仍使用使用者自己的 HTTPS endpoint 與 AES-GCM 流程。
- GitHub Pages 主訓練不需要 API key；Gemini server mode 的 key 僅留在 server environment。
