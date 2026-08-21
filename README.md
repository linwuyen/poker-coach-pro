# ♠️ 想高龍了 德撲訓練機

**History v6 · Closed-loop Decision Tutor · Strategy Engine v2/v3/v4 · P0→P17**

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
- Preflop full truth：外部 immutable **Strategy Profile v2** surfaces
- Heads-up postflop full truth：外部 immutable **Postflop Truth Pack v3** nodes
- Multiway postflop full truth：外部 immutable **Multiway Truth Pack v4** nodes
- coverage 只依實際匯入的 verified solver data 計算；repo **不宣稱內建完整 EV database**

## P0–P12 已完成基礎

- **P0–P4**：Daily Expected Learning Value、spaced review、weighted sampling、V12 progressive disclosure、canonical mastery、PokerBench semantic counterfactual、Training/Sibling/Holdout leakage guard。
- **P5**：PokerStars/GGPoker HH ingestion、Strategy Profile v2 full surface、observational effectiveness、real Chrome production E2E。
- **P6**：64 exact-math semantic boundary families，讓 genuine decision families 到 152。
- **P7**：evidence-backed `population-exploit` profile contract；沒有 provenance/sample/methodology 不升級。
- **P8**：FGS explicit finite future-state tree + exact ICM leaves；不猜 future branch probability。
- **P9**：solver coverage、population cohort registry、HH→truth→leak→Daily、explicit tournament ICM/PKO/FGS join、human-reviewed solver teaching。
- **P10**：preregistered randomized N-of-1，balanced deterministic block assignment、washout、primary metric、minimum sample gate。
- **P11**：route-level lazy chunks、真 Chrome critical-route smoke、500 KiB minified JS chunk hard budget。
- **P12**：Strategy Engine v3 exact heads-up Flop/Turn/River context、immutable v3 truth pack、HH postflop exact regret、measured local population cohorts、tournament metadata reconstruction。

## P13 · 真實大資料 production scale

入口：`#production-ops`、`#postflop-truth`、`#hand-history`

### P13-A · Indexed truth store

v3 solver truth 不再以整包 JSON 寫入 `localStorage` 或每次 `nodes.filter()`：

```text
solver pack / NDJSON
  ↓
validate immutable node
  ↓
IndexedDB
  ├─ nodes
  ├─ context index
  ├─ context metadata
  └─ pack manifests
  ↓
contextKey exact lookup
```

- browser 使用 IndexedDB；Node/tests 使用 deterministic memory fallback。
- 舊 `poker_postflop_truth_nodes_v3` 只做一次 migration，不再作為新 truth write path。
- diagnostics 使用 `count()` / manifest metadata，不為了顯示統計而全量讀出 solver nodes。
- NDJSON 可以逐行 streaming import，避免先把大型 export 整包展開到記憶體。

### P13-B · Solver export adapter

提供 explicit/configurable solver CSV mapping：

- exact board / positions / stack / pot / SPR / to-call
- preflop + current-street line JSON
- Hero exact combo
- action frequency
- optional per-action EV
- solver name/version/reference/generatedAt

CSV 只有在每個 material field 都能明確映射時才轉成 v3 pack；不假裝某個 undocumented proprietary layout 是通用格式，也不補不存在的 EV/frequency。

### P13-C · HH integrity guard

自動 solver grading 現在會先做 fail-closed audit。以下未完整建模狀態只保留 exposure：

- straddle / dead blind
- multiple runout / run-it-twice
- side pot / main pot geometry
- cash-out semantics
- raise 缺 exact raise-to amount
- Hero/button/blind/table geometry 不完整

### P13-D · Observability

Production Ops 直接顯示 v3/v4 backend、node/context/pack counts 與 manifest-size signal。觀測本身不改變 truth tier。

## P14 · Exact Multiway Postflop Truth v4

P14 沒有把 v3 的 `playersInHand: 2` 放寬，而是建立獨立 **Strategy Engine v4**。

每個 3-way+ solver node 必須列出：

- Hero position + remaining stack
- **每個 active opponent** 的 position + remaining stack
- players in hand
- pot / SPR / to-call
- exact board
- preflop line + street line
- last aggressor
- rake/cap when material
- exact Hero combo

HH replay 只有在完整 multiway context 對上**唯一 verified immutable v4 node**、且 chosen/comparison action 有真實 EV 時才寫 regret。v3 heads-up truth 永遠不 fallback 到 multiway。

## P15 · Tournament automation

除了 P12 explicit JSON registry，新增：

- normalized full-field lobby/snapshot CSV → tournament metadata registry
- tournamentId + handId + playersRemaining
- every player stack
- optional bounty snapshot
- payout vector / utility unit
- generatedAt / reference / methodology
- conservative PokerStars-style tournament summary payout parser

普通 table HH 仍不會被視為 full tournament field。Summary 只證明它明確列出的 payout；ICM/PKO/FGS 的 showdown equity、future branch probabilities 等 decision-specific input 仍必須有明確來源。

## P16 · Replicated Population Evidence

牌池偏差現在有 train/holdout validation，而不是只看一個百分比：

```text
predeclared metric
+ solver baseline/reference
+ training numerator/denominator
+ independent holdout numerator/denominator
  ↓
Wilson 95% intervals
+ sample gates
+ practical-delta gate
+ same-direction replication
  ↓
validated-deviation / not-replicated / insufficient
```

預設 sample gate：training ≥ 1,000、holdout ≥ 500；practical delta 預設 3 percentage points。

**Validated deviation ≠ exploit strategy。** 只有再連到 context 完全相符、且本來就通過 P7 provenance/sample gate 的 `population-exploit` Strategy Profile，系統才標 `exploitEligible`。沒有這個 profile 就不自己合成 exploit range。

## P17 · Longitudinal Coach

只用 `verified-solver` / `exact-math` 的 Cash BB real-game evidence 建立長期結果：

- monthly verified decisions
- average EV loss BB / decision
- solver-aligned rate
- frequency-weighted leak signal
- street breakdown
- decision-family early vs recent regret
- current training prescriptions

Prescription 排序使用：

> verified real-game loss × encounter-frequency signal × repair need × evidence confidence

最近訓練 accuracy / delayed retention 會影響 repair need。Raw HH exposure 不進 verified outcome。

P17 的 month/family improvement **預設仍是 observational**；只有另外通過 P10 preregistered randomized N-of-1 的 intervention comparison，才可以做個人層級較強的 causal claim。

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
- v3 是 exact heads-up；v4 是 exact multiway；兩者不互相做 approximate fallback。
- Local population HH cohort 是 measured observation，不等於 exploit truth。
- P16 validated deviation 也不會自己生成 exploit strategy。
- Tournament payout/full-field/FGS probability 不從普通 HH 猜。
- Reviewed explanation 是 human interpretation，不是 raw solver rationale。
- P17 observational trend 不冒充 randomized causality。

完整邊界：[`docs/DATA_TRUST_CONTRACT.md`](docs/DATA_TRUST_CONTRACT.md)  
閉環架構：[`docs/CLOSED_LOOP_ARCHITECTURE.md`](docs/CLOSED_LOOP_ARCHITECTURE.md)  
Postflop truth format：[`docs/POSTFLOP_TRUTH_PACK_V3.md`](docs/POSTFLOP_TRUTH_PACK_V3.md)

## 主要入口

```text
#hand-history          HH exposure + integrity audit + Preflop v2 / HU v3 / Multiway v4 strict grading
#postflop-truth        indexed v3 truth + legacy migration + explicit tournament metadata
#production-ops        P13–P17 scale/import/multiway/tournament/population/longitudinal operations
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

PR merge 前必須讓**最新 head**的 GitHub Actions 全綠。

## 資料與隱私

- Training history / HH-derived evidence / small metadata registries 預設在 browser local storage。
- v3/v4 大型 postflop truth 使用 browser IndexedDB；舊 v3 localStorage truth 只做一次 migration。
- 原始 HH 不會自動上傳第三方。
- measured-local-cohort 保存 aggregate counts + hand-id hash，不把它冒充公開 population dataset。
- 外部 solver / population data 的授權與 provenance 必須由匯入來源本身成立；repo 不製造缺失資料。
- JSON backup 支援 History 匯出/匯入；既有遠端同步仍使用使用者自己的 HTTPS endpoint 與 AES-GCM 流程。
- GitHub Pages 主訓練不需要 API key；Gemini server mode 的 key 僅留在 server environment。
