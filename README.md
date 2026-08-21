# ♠️ 想高龍了 德撲訓練機

**Infinite Hand Generator · History v6 · Truth-constrained Decision Tutor**

繁體中文德州撲克決策訓練系統。產品現在只有一個核心行為：

> **一直打牌。每個 decision 自動記錄；下一手由系統依 truth、變化度、近期重複、漏點與複習需求自動選擇。**

線上版本：**https://linwuyen.github.io/poker-coach-pro/**

## Product model

正常玩家介面只保留：

```text
今天 → 訓練 → 進度
        ↓
Infinite Hand Generator
        ↓
Fold / Check / Call / Bet / Raise / Jam
        ↓
自動記錄 → 自動分析 → 自動選下一手
```

**真實牌局 / Hand History 匯入已退出產品 runtime。** 本產品不是 tracker，也不需要連接 PokerStars / GGPoker / 其他 poker client。

玩家不需要填 solver JSON、range provider、HH、confidence 或工程設定。正常訓練只做 poker decision。

## Infinite Hand Generator

Generator 統一三個 truth-backed source inventory：

1. **216 production scenarios**
   - 152 genuine decision families
   - 64 suit-isomorphic retrieval instances
   - 經 scenario semantic validator 驗證
2. **528 strategy-equivalent variants**
   - 由 88 core scenarios × 6 產生
   - 只做全域 suit permutation
   - 不擅自改 stack、position、bet size、range 或 board rank
3. **PokerBench pinned solver corpus**
   - 1,000 Preflop
   - 10,000 Postflop
   - pinned revision `52a402ba1cf00ca8f4138f8d6da278f6f9477bab`
   - Apache-2.0
   - 只使用 training partition

實際可訓練數量會小於 source inventory 總數，因為 generator 在出題前會依序套用：

```text
source inventory
  ↓
truth gate
  ↓
hidden holdout isolation
  ↓
exact presentation dedupe
  ↓
recent candidate cooldown
  ↓
recent decision-family cooldown
  ↓
source balancing + leak/review weighting
  ↓
下一手
```

### Truth gate

只有能證明最佳解的 candidate 才能出題：

- Curated scenario：每個 step 必須有一致且有效的 `bestAction`。
- Safe variant：只繼承策略等價 transformation 下不變的 ground truth。
- PokerBench：`correctDecision` 必須明確存在於該 row 的 `availableMoves`，而且必須屬於 training partition。

沒有可靠 truth 的隨機組合 **不生成、不評分、不用附近 node 猜答案**。

### Benchmark isolation

Hidden benchmark 不拿來訓練：

- curated hidden holdout 排除；
- 從 hidden source 衍生的 528-pool variant 也排除；
- PokerBench sibling / holdout 排除。

因此增加題量不會污染 transfer / holdout 驗證。

### 去重與高變異

Generator 不是單純把題庫 shuffle。

`presentationFingerprint` 會把實際可見策略狀態編碼，包括：

- format / table size
- Hero position
- stack / blinds
- pre-action line
- exact hole cards
- street / board
- pot / SPR
- available action tree
- verified best action

完全相同 presentation 先 dedupe；另外記住最近 candidate 與 decision family，避免一直看到同一題或同一類題。

### Adaptive sampling

下一手不是純均勻亂數。概念上：

```text
P(next)
∝ source coverage
× novelty
× recent mistake weight
× due-review weight
× transfer value
```

目前 source target 約為：

- curated 30%
- safe variants 25%
- PokerBench 45%

若 PokerBench 暫時無法下載，216 + 528 inventory 的 holdout-safe subset 仍可立即訓練；不會因外部 corpus 暫時 unavailable 而停止。

## 最佳解的語意

不同 source 的「最佳解」精度不同，UI/History 不混淆：

```text
PokerBench            → verified solver optimal label
Curated scenario      → validated teaching / exact-math ground truth
Safe generated variant→ strategy-equivalent inherited truth
```

PokerBench 只提供 optimal decision label；repo **不會假造缺失的 mixed frequency 或 per-action EV**。

有真實 per-action EV 的 scenario 才顯示 EV loss；只有 label 的 solver row 就只判斷 action label。

核心規則仍是：

> **fail toward Unknown, not fabricated precision**

## 自動學習迴圈

每次玩家做 action，History v6 自動保存可用欄位：

- decision family / scenario or solver row identity
- selected action / best action
- street / position
- reaction time
- correctness
- EV loss（只有來源真的提供時）
- review / unseen / delayed-review state
- truth provenance（solver row 時）

這些紀錄直接影響後續 sampling：錯得多、已到複習時間的 family 會增加權重；近期剛出現的 exact candidate / family 則降權或 cooldown。

## Player UI

### 今天

只回答：今天做了多少 decision、目前最大 leak、直接繼續下一手。

### 訓練

直接進 Infinite Hand Generator；不選 workbench、不填 confidence。

### 進度

只看：正確率、留存、transfer、mastery、最大 leak、最近 decisions。

## Advanced truth tools

部分純訓練 / truth 工具仍保留為非主流程 advanced routes，例如：

```text
#truth-ops
#postflop-truth
#strategy-surface
#solver-corpus
#solver-benchmark
#semantic-counterfactual
#decision-boundary
#boundary-map
#contrastive-trainer
#equity-workbench
#icm-workbench
#fgs-workbench
#experiment
#effectiveness
#skill-graph
#calibration
```

它們不是正常玩家 workflow；Infinite Hand Generator 才是產品主入口。

以下 real-game runtime routes 已移除，不再提供 HH / 外部牌局 workflow：

```text
#hand-history
#production-ops
#evidence-ops
#production-intelligence
#tournament-context
```

## Production baseline

- Production source：`main`
- Web：GitHub Pages / PWA
- Runtime：Node.js 24+ / npm 11
- History：schema v6
- Scenario validator：216 production scenarios
- Generated safe variant inventory：528
- PokerBench inventory：11,000 solver-labelled rows
- Bundle budget：每個 JS chunk < 500 KiB

## Local development

```bash
npm ci
npm run check
npm run build:web
npm run check:bundle
npm run e2e:browser
```

Development server：

```bash
npm run dev
```

## Architecture contracts

- [`docs/INFINITE_HAND_GENERATOR.md`](docs/INFINITE_HAND_GENERATOR.md)
- [`docs/DATA_TRUST_CONTRACT.md`](docs/DATA_TRUST_CONTRACT.md)
- [`docs/VOLUME_FIRST_PRODUCT_MODEL.md`](docs/VOLUME_FIRST_PRODUCT_MODEL.md)

North star：

> **不是做更多工具，而是讓玩家能打大量、多變、可驗證最佳解的 decision，系統在背景自動完成剩下所有學習工作。**
