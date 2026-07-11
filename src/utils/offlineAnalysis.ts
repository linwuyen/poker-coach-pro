import { ActionType } from "../types";

export interface OfflineAnalysisResult {
  analysis: string;
}

// Simple texture helper
function analyzeBoardTexture(cards: { rank: string; suit: string }[]) {
  if (!cards || cards.length === 0) return "Preflop";
  
  const ranks = cards.map(c => c.rank);
  const suits = cards.map(c => c.suit);
  
  // Check if paired
  const rankCounts: Record<string, number> = {};
  ranks.forEach(r => { rankCounts[r] = (rankCounts[r] || 0) + 1; });
  const maxSameRank = Math.max(...Object.values(rankCounts));
  const isPaired = maxSameRank >= 2;
  const isTrips = maxSameRank >= 3;
  
  // Check if suited / flush draw
  const suitCounts: Record<string, number> = {};
  suits.forEach(s => { suitCounts[s] = (suitCounts[s] || 0) + 1; });
  const maxSameSuit = Math.max(...Object.values(suitCounts));
  const isFlushPossibility = maxSameSuit >= 3;
  const isFlushDraw = maxSameSuit === 2 || maxSameSuit === 3;
  
  // Check if connected
  const rankValues: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };
  const sortedValues = Array.from(new Set(ranks.map(r => rankValues[r] || 0))).sort((a,b) => a - b);
  
  let isConnected = false;
  if (sortedValues.length >= 3) {
    for (let i = 0; i <= sortedValues.length - 3; i++) {
      if (sortedValues[i+2] - sortedValues[i] <= 4) {
        isConnected = true;
        break;
      }
    }
  }

  if (isTrips) return "重複成三條極乾牌面";
  if (isPaired && isFlushPossibility) return "公對帶同花濕重牌面";
  if (isPaired) return "公對乾燥牌面";
  if (isConnected && isFlushPossibility) return "順子與同花極濕重牌面";
  if (isConnected) return "連接性高的濕重牌面";
  if (isFlushPossibility) return "同花聽牌/成牌面";
  if (isFlushDraw) return "兩高張帶同花聽牌潛力牌面";
  return "高張乾燥牌面";
}

export function generateOfflineAnalysis(scenario: any, currentStep: any): OfflineAnalysisResult {
  const profile = scenario?.villainProfile || "常規玩家 (REG)";
  const street = currentStep?.street || "Preflop";
  const community = currentStep?.communityCards || [];
  const boardTexture = analyzeBoardTexture(community);
  const userCards = scenario?.holeCards || [];
  const holeCardsStr = userCards.map((c: any) => `${c.rank}${c.suit}`).join('');
  const potSize = currentStep?.potSize || "未知";
  const position = scenario?.position || "未知";
  const userBB = scenario?.userBB || "100";

  let mindsetAnalysis = "";
  let rangeAnalysis = "";
  let explosiveAdvice = "";

  // 1. Mindset analysis based on villain profile & action
  if (profile.includes("跟注站") || profile.includes("Calling Station") || profile.includes("魚") || profile.includes("Fish")) {
    mindsetAnalysis = `對手是一位典型的**跟注站 (Calling Station)**。他的核心心理是「不想被欺負」與「對自己的手牌有著過度的不安全感但又捨不得棄牌」。
在目前的 **${street}**，他的行動（過牌或跟注）反映了他極度被動、極不願意主動下注但非常樂意用極寬的範圍「看下一張牌」的傾向。他幾乎沒有主動詐唬的心態，他的下注通常是純粹的價值，而他的跟注則包含了大量的中等對子、低底對甚至是任何後門聽牌。`;
  } else if (profile.includes("瘋狂") || profile.includes("Maniac") || profile.includes("瘋子")) {
    mindsetAnalysis = `對手是一位高侵略性的**瘋狂玩家 (Maniac)**。他的動機在於「主導底池」與「利用高壓迫感逼迫你棄牌」。
在當前 **${street} (${boardTexture})**，對手非常清楚位置和主動權的威力。他的下注或加注行為是高度兩極化的（強堅果或空氣詐唬）。他享受你陷入糾結的過程，因此他會故意放大下注尺寸，試圖將局勢引導至不對稱的高風險狀態。他的防線極具彈性但漏洞百出。`;
  } else if (profile.includes("鬆凶") || profile.includes("LAG") || profile.includes("Loose-Aggressive")) {
    mindsetAnalysis = `對手是一位高水平的**鬆凶型玩家 (LAG)**。他善於利用位置優勢、範圍寬度以及玩家的心理防線進行多街施壓。
在當前 **${street}** 面對 **${boardTexture}**，對手的思維處於第二或第三層次。他正在積極尋找你的範圍弱點。如果他選擇下注，他不僅是在進行價值擠壓，更是在用寬廣的強聽牌或具有高阻擋效應的空氣牌進行持續下注 (C-Bet)。他希望利用你過於保守的棄牌傾向，榨取你在邊緣手牌上的籌碼。`;
  } else if (profile.includes("緊凶") || profile.includes("TAG") || profile.includes("REG") || profile.includes("常規")) {
    mindsetAnalysis = `對手是一位思維縝密、行事沉著的**緊凶型常規玩家 (TAG/REG)**。他遵循平衡的 GTO 策略，且對牌面結構有極強的閱讀能力。
在 **${street}** 上，對手當前的行動是極具紀律性的。他的下注尺寸通常與他的手牌強度、聽牌阻擋牌 (Blocker) 高度掛鉤。他試圖在保護自身範圍（不被你剝削）的同時，向你的跟注範圍索取價值。如果他主動進攻，代表他持有一手具備可觀勝率的半詐唬牌（如強聽牌）或已經領先的價值牌。`;
  } else if (profile.includes("緊被動") || profile.includes("Nit") || profile.includes("岩石") || profile.includes("Rock")) {
    mindsetAnalysis = `對手是一位極度保守、風險厭惡的**緊被動型玩家 (Nit)**。他的核心動機是「避免輸掉大底池」。
在 **${street}** 如此關鍵的時刻，對手的心理警報已經拉響。他只有在手持超強成牌（如兩對、暗三條以上）或具有極高阻擋效應的超強聽牌時，才會採取積極的進攻手段。他的下注完全沒有純詐唬成分，他也絕不會用空氣牌或中等對子去冒生命危險。`;
  } else {
    mindsetAnalysis = `對手是一位綜合型的**常規玩家**。在當前的 **${street} (${boardTexture})**，他正在進行標準的位置防守或持續攻擊。
他的動機偏向中規中矩：在乾燥牌面上利用持續下注獲取死錢；在濕重牌面上則利用聽牌或頂對進行控池。他對你的下注尺寸非常敏感，正在試圖透過你的出牌時間和下注額度來判斷你的牌力深度。`;
  }

  // 2. Range Analysis based on street & texture
  if (street === "Preflop") {
    rangeAnalysis = `基於 Preflop 的行動，對手當前所呈現的牌力範圍高度凝聚：
- **強價值區 (Top 5%)**：\`QQ+\`, \`AKs\`, \`AKo\` (這部分在面對你加注時多半會進行 3-bet 或 4-bet)
- **邊緣價值/同花大張 (10%-15%)**：\`TT-88\`, \`AQs-ATs\`, \`KQs\`, \`AQo\`
- **投機型聽牌 (15%-25%)**：\`77-22\` 的口袋對子（試圖聽暗三條 Set）、\`JTs-76s\` 等同花連牌，以及部分同花 A 牌（\`A5s-A2s\` 做 3-bet 詐唬阻擋牌）。
*如果對手是 Nit，其範圍將收窄至最頂端的 6% 內。*`;
  } else {
    rangeAnalysis = `配合當前公共牌面 **${boardTexture}** 進行多街過濾，對手的估算手牌範圍細分如下：
- **超強價值區 (15%)**：\`暗三條 (Set)\`、\`兩對 (Two Pairs)\` 或已成牌的\`順子/同花\`。這些是他在當前街最主要的籌碼來源。
- **邊緣/頂對價值區 (35%)**：\`頂對頂 Kicker (TPTK)\`、\`頂對中 Kicker\` 或強超對。這類牌對手會傾向下注 1/2 至 2/3 底池以進行保護與索取中等價值。
- **強聽牌範圍 (25%)**：在這種牌面上，包含了\`強同花聽牌 (Flush Draw)\`、\`兩頭順聽牌 (OESD)\`。高水平對手會高頻率地將這部分加入他的半詐唬範圍中。
- **空氣/破產/阻擋牌 (25%)**：持有卡順聽牌、後門聽牌或完全未中的高張，通常帶有 \`A\` 或 \`K\` 作為阻擋對手強牌的武器。`;
  }

  // 3. Exploitative advice
  if (profile.includes("跟注站") || profile.includes("Calling Station") || profile.includes("魚") || profile.includes("Fish")) {
    explosiveAdvice = `1. **絕對不要主動對他進行純粹的空氣詐唬**。跟注站不會因為你下注大而棄掉他的底對或聽牌，這無異於將籌碼送人。
2. **極大化你的價值下注 (Max Value)**。當你拿到頂對強 Kicker 或更好的手牌時，請毫不猶豫地下大注（如 3/4 底池甚至超額下注），對手會用極寬的邊緣牌跟注。
3. **遇到他的加注時請保持高度警惕**。被動玩家一旦主動加注，通常代表他已經拿到兩對以上的絕對強牌，此時你應果斷放棄邊緣頂對。`;
  } else if (profile.includes("瘋狂") || profile.includes("Maniac") || profile.includes("瘋子")) {
    explosiveAdvice = `1. **採取「過牌-跟注」防守線 (Check-Call)**。不要主動去反擊加注，而是放慢節奏，主動讓出主導權，引誘他持續瘋狂地下注、自己把底池做大。
2. **放寬你的跟注範圍**。面對這種對手，中等強度的牌（例如頂對中 Kicker、甚至第二對子）在合適的乾淨牌面上，都可以連續跟注兩到三街。
3. **不要試圖用半強聽牌去加注他**。直接跟注，保留他繼續在下一街詐唬的空間，這才是最大化搾取瘋狂玩家價值的黃金法則。`;
  } else if (profile.includes("緊被動") || profile.includes("Nit") || profile.includes("岩石") || profile.includes("Rock")) {
    explosiveAdvice = `1. **大幅提升你的棄牌頻率**。面對 Nit 的下注，你可以毫無懸念地棄掉所有邊緣手牌（包括頂對弱 Kicker）。他的下注範圍內幾乎沒有任何你能擊敗的牌。
2. **在 Preflop 頻繁偷盲與在 Flop 進行低額持續下注**。Nit 只有中強牌才會反擊，否則他們會極其輕易地放棄盲注和底池，這是你賺取死錢的最佳機會。
3. **一旦他跟注你的大額下注，後續街請立即踩煞車**，因為他的跟注範圍同樣是極度純淨且強大的。`;
  } else {
    explosiveAdvice = `1. **利用「下注尺寸 (Bet Sizing)」探測他的強度**。在乾燥牌面上，可以使用 1/3 底池的小額下注來控池與偵測；在濕重牌面上則必須使用 2/3 以上的大額下注來給聽牌施加壓力。
2. **注意位置權的流動**。如果你處於有利位置 (IP)，請利用過牌背後跟注 (Check-Behind) 或延遲持續下注來調整底池大小，避免將自己逼入絕境。
3. **建立一個清晰的「兩街價值」或「三街價值」計劃**。不要盲目下注，問自己：如果我下注，對手更弱的牌會跟注我嗎？如果是，那就勇敢下注；如果只有比你強的牌會跟注，請選擇過牌。`;
  }

  const analysisMarkdown = `
# 🧠 對手心態解析 (Mindset & Motivation)
${mindsetAnalysis}

# 🃏 手牌範圍估計 (Estimated Range)
${rangeAnalysis}

# 🎯 實戰剝削策略 (Explosive Advice)
${explosiveAdvice}

---
*⚡ 本次分析由 **本機離線撲克策略引擎** 即時生成 (0ms 延遲，免網路、免金鑰)。*
`;

  return {
    analysis: analysisMarkdown.trim()
  };
}

// Interactive Q&A responder for offline chat
export function generateOfflineFollowUp(question: string, scenario: any, currentStep: any): string {
  const q = question.toLowerCase();
  const profile = scenario?.villainProfile || "常規玩家";
  const street = currentStep?.street || "當前";
  
  if (q.includes("詐唬") || q.includes("bluff")) {
    if (profile.includes("跟注站") || profile.includes("Calling Station") || profile.includes("Nit")) {
      return `### 🃏 關於對手是否在詐唬？
在目前的戰局下，考慮到對手的形象為 **${profile}**，他**幾乎不可能是在詐唬**。
- **原因**：被動型玩家與緊縮型 Nit 的血液裡沒有詐唬的基因。除非他手握超強牌或完全成牌，否則在 **${street}** 承受壓力時，他絕不會憑空捏造下注。
- **建議**：如果你此時只有一對或弱聽牌，請果斷棄牌，千萬不要心存僥倖去「抓詐唬」。`;
    }
    if (profile.includes("瘋狂") || profile.includes("Maniac") || profile.includes("LAG")) {
      return `### 🃏 關於對手是否在詐唬？
極有可能是！對手形象為高侵略性的 **${profile}**，他的下注範圍內包含了非常高比例的**純詐唬與半詐唬**。
- **原因**：他試圖利用高下注尺寸來擊碎你的持牌信心。在目前的牌面上，許多聽牌（如順子、同花聽牌）如果未中，他會選擇繼續開火。
- **建議**：如果你持有中強度的頂對或超強中對，請採取「過牌-跟注 (Check-Call)」的控池打法，讓他一條街一條街地把他的詐唬籌碼送進底池。`;
    }
    return `### 🃏 關於對手是否在詐唬？
在目前的 **${street}**，常規對手的詐唬頻率通常維持在 **20% - 30%** 左右（多為半詐唬，例如同花或順子聽牌）。
- **原因**：合理的常規玩家會平衡他的下注範圍。他當前的下注尺寸決定了他的詐唬比例。如果他下注半底池，他需要大約 25% 的詐唬牌來保持平衡。
- **建議**：請檢查你手中的牌是否含有阻擋牌（例如，如果你持有同花 A，你就阻擋了對手最大同花聽牌的詐唬組合）。如果阻擋了對手的詐唬牌，你應該更傾向於棄牌；反之則可以考慮跟注。`;
  }

  if (q.includes("加注") || q.includes("raise")) {
    return `### 🎯 關於此處是否應該加注？
在目前的 **${street}** 街，採取加注 (Raise) 通常需要滿足以下兩個條件之一：
1. **純粹的價值加注**：你手握極強牌（如兩對、三條、順子以上），且對手會用大量更差的牌（如頂對、聽牌）跟注你。
2. **作為半詐唬 (Semi-Bluff)**：你手持強聽牌（如兩頭順帶同花抽牌），希望透過加注建立棄牌率 (Fold Equity)，直接拿下底池；即使被跟注，在後續街也保有極高的成牌勝率。

**針對 ${profile} 的剝削調整**：
- 如果對手是**跟注站**：千萬不要用聽牌「詐唬加注」他，因為他不會棄牌。請只在持有絕對好牌時進行「超大額價值加注」。
- 如果對手是**瘋狂玩家**：請勿主動加注，因為這會逼迫他的詐唬牌棄牌，只留下能擊敗你的超強牌跟注。此時「過牌-跟注」是更好的打法。`;
  }

  if (q.includes("棄牌") || q.includes("fold")) {
    return `### 🛡️ 關於此時是否該棄牌 (Fold)？
棄牌是德州撲克中最省錢、也最需要紀律性的藝術。
- 如果對手是 **Nit (緊被動玩家)** 或 **跟注站**，且此時他展現出不尋常的猛烈攻勢（例如加注或大額下注），那麼無論你手中的頂對看起來有多漂亮，**在此處棄牌都是長正期望值 (+EV) 的正確決定**。
- 在面對 **Maniac (瘋狂玩家)** 時，請不要輕易棄牌。你可以放寬你的跟注範圍，用中等對子去跟注他的詐唬，藉此獲得高額回報。
- **數學思維**：請計算你的**底池勝率 (Pot Odds)**。如果對手下注 1/2 底池，你跟注需要約 25% 的勝率。如果你手牌的贏面或聽牌成牌率低於此數值，棄牌就是唯一正確的選擇。`;
  }

  if (q.includes("跟注") || q.includes("call")) {
    return `### 📥 關於此處跟注 (Call) 的考量
跟注通常用於「控池（不希望把底池無限做大）」、「保留對手的詐唬範圍（如果加注會嚇跑他的空氣牌）」或「便宜聽牌」。
- **優點**：降低波動性，可以隱蔽自己的牌力強度，並給對手後續街繼續詐唬的機會。
- **缺點**：讓出主導權，無法在當前街建立棄牌率，且如果對手在下一街繼續下重注，你會面臨更艱難的抉擇。
- **實戰要點**：如果你手中是中強牌（如頂對弱 Kicker 或中對子），或者是一手聽牌但底池成數非常合適，跟注是最佳防禦手段。`;
  }

  if (q.includes("gto") || q.includes("平衡")) {
    return `### 📐 關於 GTO (遊戲理論最佳化) 的看法
從 GTO 的視角出發，在當前街，你的手牌需要被分類進「下注範圍」、「過牌-跟注範圍」或「過牌-棄牌範圍」：
- **混合策略**：GTO 在許多中等強度的牌上會採取混合策略（例如 30% 機率下注，70% 機率過牌），以防止對手看穿你的打法。
- **為什麼在這裡剝削比 GTO 更好**：因為你面對的是 **${profile}**，他本身的打法已經嚴重偏離了 GTO（例如過度跟注、或從不詐唬）。在此時，**純粹的剝削性策略 (Explosive Play) 會比死守 GTO 帶來多出數倍的利潤**！`;
  }

  return `### 💡 AI 教練實戰解惑
針對你提到的問題，教練建議你從以下三個維度進行深度思考：
1. **阻擋牌效應 (Blocker Effect)**：你手中的牌是否阻擋了對手的最強價值牌（例如你有一張 A，對手拿到 AA 或 AK 的組合數就減半）？
2. **對手的下注尺寸暗示**：對手下注的額度是偏向引誘你跟注（小下注），還是想把你逼走（大下注）？對手在不同牌面上是否有習慣的下注習慣？
3. **後續街的計劃**：如果跟注，下一張牌發出任何非同花、非連接的牌，你打算如何應對對手的下注？如果發出聽牌，你是否有主動轉為詐唬的計劃？

保持冷靜，專注於期望值 (+EV) 的決策，而不是單次手牌的輸贏！`;
}
