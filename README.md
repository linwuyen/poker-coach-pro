# ♠️ 想高龍了 德撲訓練機

**History v6 · Closed-loop Decision Tutor · Strategy Engine v2/v3/v4 · P0→P30**

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
- **P14**：獨立 Strategy Engine v4；3-way+ 保存每個 active opponent position + remaining stack，v3 不 fallback 到 multiway。
- **P15**：full-field tournament lobby/snapshot ingestion + conservative tournament summary payout extraction。
- **P16**：train/holdout population deviation validation、Wilson 95% intervals、sample/practical-delta gate；deviation 不自動生成 exploit。
- **P17**：verified real-game regret longitudinal outcomes + leak-priority prescriptions；observational trend 不冒充 causal result。

## P18–P23 · Real-world Evidence Loop

入口：`#hand-history`、`#evidence-ops`

- **P18-A**：straddle / dead blind → canonical `forcedBetKey`；straddle 是 live commitment，dead blind 是 dead money。
- **P18-B**：active all-in side-pot eligibility → contribution tiers + `potStructureKey`；只有同 tier geometry 的 v4 node 可 exact grade。
- **P18-C/D**：run-it-twice / cash-out 若只發生在 Hero 所有下注決策之後，不污染先前 grading；settlement 後仍有 Hero decision 則 Unsupported。
- **P18-E**：v4 IndexedDB/context metadata/manifests/NDJSON/paged iteration 與 v3 scale parity；v3/v4 streaming manifest 保存真實 counts/bytes。
- **P19**：v2/v3/v4 unified truth portfolio；unique usable combos、full-EV combos、ambiguous overlap。Coverage 百分比只能對 versioned `TruthCoverageTargetEnvelope` 計算。
- **P20**：explicit tournament range → equity；exact enumeration 才 `exact-eligible`，Monte Carlo 永遠 `simulation-only`。FGS probability 必須完整 referenced edges。
- **P21**：外部 `population-exploit` candidate + independent paired EV holdout；N≥200、practical gain、95% interval > 0 才 validated。
- **P22**：P10 preregistered randomized result 可掛回對應 P17 leak family 的 `recommendedIntervention`，不改 solver truth / leak magnitude。
- **P23**：大型 v3/v4 truth NDJSON portable workspace；stream export、validate-first、additive immutable restore。

完整契約：[`docs/REAL_WORLD_EVIDENCE_LOOP.md`](docs/REAL_WORLD_EVIDENCE_LOOP.md)

## P24 · Solver Truth Acquisition Control Plane

入口：`#production-intelligence`

P24 把 P19 的 target universe 轉成真正的 acquisition backlog：

```text
actual v2/v3/v4 coverage
+ versioned target envelope
+ solver source inventory
  ↓
license gate + content-hash dedupe
  ↓
missing-context / insufficient-combos / insufficient-full-EV / ambiguous gaps
  ↓
installable candidate sources
```

Source inventory 必須有 solver/version/reference/content hash/license status。`unknown` license 只能列 inventory，不會被推薦安裝。P24 **不會憑空產生 solver truth**；實際 coverage 仍取決於使用者合法取得並匯入的資料。

## P25 · Multi-site Hand History

入口：`#hand-history`、`#production-intelligence`

支援同一條 conservative normalization / replay path：

- PokerStars
- GGPoker
- Winamax
- WPN
- PartyPoker
- iPoker

External adapter 只正規化可證明的 header / table / button / seat / action syntax，並保留站點 provenance。正規化後仍走同一套 P18 integrity、v2/v3/v4 grading、population、tournament join 與 History pipeline；不能證明的 geometry 保持 Unknown/Unsupported。

## P26 · Tournament Evidence Providers

入口：`#production-intelligence`

Provider descriptor 有 identity/version/kind/reference/methodology/capabilities。Range response 必須對 exact hand + Hero cards + board；FGS response 必須對 exact tree edge set。

```text
0 provider matches  → unavailable
1 provider matches  → P20 evidence validation
>1 providers match  → ambiguous
explicit selection  → selected provider only
```

Array order / provider priority 永遠不偷偷決定 material tournament input。

## P27 · Exploit Candidate Discovery

入口：`#production-intelligence`

P27 可以**找 candidate，但不能跳過 validation**：

```text
verified-solver baseline
+ P16 validated population deviation
+ explicit response model (sample ≥ 1000)
+ bounded search constraints
  ↓
derived-interpolation proposal
  ↓
independent paired holdout (different reference)
  ↓
N ≥ 200 + practical gain + positive 95% lower bound?
  ├─ no  → remains derived proposal
  └─ yes → promote exact proposal to population-exploit
```

預設每手最大 frequency shift 0.20，hard limit 0.50。Training-model EV 正值本身不構成 exploit truth。

## P28 · Personal Intervention Model

入口：`#production-intelligence`

P22 是單次 randomized evidence；P28 只從**重複**實驗學個人化 intervention：

```text
decisionFamilyId + primary metric + intervention
  ↓
dedupe experiment key
  ↓
≥ 2 distinct randomized experiments
  ↓
personal intervention recommendation
```

不同 primary metric 不會合併成一個 effect。P28 只影響「這個 leak 用什麼方法練」，不改 P17 leak priority、solver truth 或 population claim。

## P29 · Full Workspace / Cross-device Revision

入口：`#production-intelligence`

P29 把 `poker_*` 可攜 local state 與 P23 v3/v4 truth 放進同一個 streaming full workspace：

```text
full header
portable local-state
embedded P23 truth stream
full footer + rolling hash
```

- API key / token / secret / password / credential / authorization 類 key 永遠排除。
- import 先驗證 full envelope，再驗證 embedded P23 truth。
- local state conflict 預設不 overwrite。
- truth 仍 additive + immutable。
- File System Access 可直接 streaming export，大型 truth 不需 combined node array。
- Cross-device revision 只在 direct ancestry 時 fast-forward；分叉一律 `conflict`，不做 silent last-write-wins。

## P30 · Production Reliability

入口：`#production-intelligence`，`#hand-history` 會寫本機 content-free events。

只記：operation / outcome / machine reason / short dimension / duration / numeric value。**不記 raw HH、cards、player names、chat、token、credential 或 free-form payload。**

30-day report 提供：

- HH parse / reconstruct success & Unsupported rate
- truth lookup Unknown rate + p50/p95
- IndexedDB / workspace / sync / experiment failures
- storage quota signal
- top machine reason codes
- actionable engineering priorities

如果 truth Unknown 過高，建議回 P24/P19 補資料，**不是放寬 exact matcher**。

完整 P24–P30 契約：[`docs/PRODUCTION_INTELLIGENCE_LOOP.md`](docs/PRODUCTION_INTELLIGENCE_LOOP.md)

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
- v3 是 exact heads-up；v4 是 exact multiway；兩者不 approximate fallback。
- P19 沒有 explicit target universe 就沒有 coverage 百分比分母。
- P24 source advertisement 不等於 verified truth；unknown license 不安裝。
- P25 site adapter 不降低 P18 exact geometry 規則。
- P26 multiple provider matches 是 Ambiguous，不偷選。
- Monte Carlo tournament equity 是 simulation evidence，不是 exact-math。
- P27 discovered proposal 先是 derived；只有獨立 holdout 通過才 promotion。
- P17 observational trend 不冒充 causal；P28 只聚合同 family + 同 primary metric 的 repeated randomized evidence。
- P29 divergent workspace revision 不 last-write-wins。
- P30 telemetry 不改 truth tier，也不保存 raw poker/user content。

完整邊界：[`docs/DATA_TRUST_CONTRACT.md`](docs/DATA_TRUST_CONTRACT.md)  
閉環架構：[`docs/CLOSED_LOOP_ARCHITECTURE.md`](docs/CLOSED_LOOP_ARCHITECTURE.md)

## 主要入口

```text
#hand-history             P25 multi-site HH → P18 geometry → v2/v3/v4 strict grading
#postflop-truth           indexed v3 truth + legacy migration
#production-ops           P13–P17 scale/multiway/tournament/population/longitudinal operations
#evidence-ops             P18–P23 geometry/coverage/tournament/exploit validation/causal/truth workspace
#production-intelligence  P24–P30 acquisition/providers/candidate discovery/personal model/full workspace/reliability
#truth-ops                v2 solver coverage / population cohort / reviewed explanation
#strategy-surface         Strategy Profile v2 inspection/import
#solver-corpus            PokerBench training corpus
#effectiveness            observational before/training/follow-up
#experiment               preregistered randomized N-of-1
#tournament-context       HH ↔ explicit ICM/PKO/FGS state join
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

PR merge 前必須讓**最新 exact head**的 GitHub Actions 全綠。

## 資料與隱私

- Training history / HH-derived evidence / small metadata registries 預設在 browser local storage。
- v3/v4 大型 postflop truth 使用 browser IndexedDB。
- P23 truth workspace 與 P29 full workspace 都是使用者明確 export/import；不會自動上傳。
- P29 永遠排除 credential-like localStorage keys。
- 原始 HH 不會自動上傳第三方。
- measured-local-cohort 保存 aggregate counts + hand-id hash，不冒充公開 population dataset。
- P30 reliability telemetry 是本機 machine labels / numeric metrics，不含 raw HH/cards/player names/secrets。
- 外部 solver / population data 的授權與 provenance 必須由匯入來源本身成立；repo 不製造缺失資料。
- 既有遠端同步仍使用使用者自己的 HTTPS endpoint 與 AES-GCM 流程；P29 revision model 不允許 divergent last-write-wins。
- GitHub Pages 主訓練不需要 API key；Gemini server mode 的 key 僅留在 server environment。
