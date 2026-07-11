import { Card, Suit, Rank } from '../types';

export function analyzeHandMath(holeCards: Card[], communityCards: Card[], potOddsStr?: string) {
  const allCards = [...holeCards, ...communityCards];
  
  // 1. Calculate suit counts
  const suitCounts: Record<Suit, number> = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 };
  allCards.forEach(c => {
    if (c.suit) {
      suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
    }
  });

  let flushDrawOuts = 0;
  let flushDrawType = '';
  Object.entries(suitCounts).forEach(([sName, count]) => {
    const suit = sName as Suit;
    if (count === 4 && communityCards.length < 5) {
      flushDrawOuts = 9;
      flushDrawType = `同花聽牌 (${suit === 'spades' ? '黑桃 ♠' : suit === 'hearts' ? '紅心 ♥' : suit === 'diamonds' ? '方塊 ♦' : '梅花 ♣'})`;
    } else if (count === 3 && communityCards.length === 3) {
      flushDrawType = `後門同花聽牌 (${suit === 'spades' ? '黑桃 ♠' : suit === 'hearts' ? '紅心 ♥' : suit === 'diamonds' ? '方塊 ♦' : '梅花 ♣'})`;
    }
  });

  // 2. Identify straight draws
  const rankValuesMap: Record<Rank, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };

  const uniqueRanks = Array.from(new Set(allCards.map(c => rankValuesMap[c.rank])));
  uniqueRanks.sort((a, b) => a - b);

  let straightDrawOuts = 0;
  let straightDrawType = '';

  if (communityCards.length < 5 && communityCards.length > 0) {
    let hasOesd = false;
    let hasGutshot = false;

    // Standard high straights (including Ace as 14)
    for (let i = 2; i <= 11; i++) {
      const count = uniqueRanks.filter(v => v >= i && v <= i + 4).length;
      if (count === 4) {
        const consecutiveCount = uniqueRanks.filter(v => v >= i && v <= i + 3).length;
        const consecutiveCount2 = uniqueRanks.filter(v => v >= i + 1 && v <= i + 4).length;
        if ((consecutiveCount === 4 && i > 2 && i + 3 < 14) || (consecutiveCount2 === 4 && i + 1 > 2 && i + 4 < 14)) {
          hasOesd = true;
        } else {
          hasGutshot = true;
        }
      }
    }

    // Ace low straights (Ace as 1)
    const lowRanks = uniqueRanks.map(v => v === 14 ? 1 : v);
    lowRanks.sort((a, b) => a - b);
    for (let i = 1; i <= 4; i++) {
      const count = lowRanks.filter(v => v >= i && v <= i + 4).length;
      if (count === 4) {
        const consecutiveCount = lowRanks.filter(v => v >= i && v <= i + 3).length;
        if (consecutiveCount === 4 && i > 1) {
          hasOesd = true;
        } else {
          hasGutshot = true;
        }
      }
    }

    if (hasOesd) {
      straightDrawOuts = 8;
      straightDrawType = '兩頭順聽牌 (OESD)';
    } else if (hasGutshot) {
      straightDrawOuts = 4;
      straightDrawType = '卡順聽牌 (Gutshot)';
    }
  }

  // 3. Combined Outs
  let totalOuts = 0;
  let outsDescription = '無明顯聽牌組合';
  if (flushDrawOuts > 0 && straightDrawOuts > 0) {
    if (straightDrawOuts === 8) {
      totalOuts = 15;
      outsDescription = '雙料超級強聽牌 (同花 + 兩頭順)';
    } else {
      totalOuts = 12;
      outsDescription = '雙料強聽牌 (同花 + 卡順)';
    }
  } else if (flushDrawOuts > 0) {
    totalOuts = flushDrawOuts;
    outsDescription = flushDrawType;
  } else if (straightDrawOuts > 0) {
    totalOuts = straightDrawOuts;
    outsDescription = straightDrawType;
  } else if (flushDrawType) {
    outsDescription = flushDrawType;
  }

  // 4. Hit Probability Estimation (Next Card and River)
  let hitProbNext = 0;
  let hitProbRiver = 0;
  if (totalOuts > 0) {
    hitProbNext = Math.round((totalOuts / 47) * 100);
    if (communityCards.length === 3) {
      const turnMiss = (47 - totalOuts) / 47;
      const riverMiss = (46 - totalOuts) / 46;
      hitProbRiver = Math.round((1 - turnMiss * riverMiss) * 100);
    } else if (communityCards.length === 4) {
      hitProbNext = Math.round((totalOuts / 46) * 100);
      hitProbRiver = hitProbNext;
    } else {
      hitProbNext = 0;
      hitProbRiver = 0;
    }
  }

  // 5. Pot Odds vs Equity comparison
  let potOddsNum = 0;
  if (potOddsStr) {
    const matched = potOddsStr.match(/(\d+(?:\.\d+)?)\s*%/);
    if (matched) {
      potOddsNum = parseFloat(matched[1]);
    }
  }

  return {
    hasDraw: totalOuts > 0,
    outs: totalOuts,
    drawDescription: outsDescription,
    hitProbNext,
    hitProbRiver,
    potOdds: potOddsNum,
  };
}

export const evaluateHandStrength = (holeCards: Card[], communityCards: Card[]): { name: string; level: number; draw?: string } => {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length === 0) return { name: "未知", level: 0 };
  
  const rankValues: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };

  const rankCounts: Record<string, number> = {};
  const suitCounts: Record<string, number> = {};
  allCards.forEach(c => {
    rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
  });

  const uniqueRanks = Array.from(new Set(allCards.map(c => rankValues[c.rank]))).sort((a, b) => a - b);
  const isSuitedFlush = Object.values(suitCounts).some(cnt => cnt >= 5);
  
  // Straight detection
  let isStraight = false;
  let straightHigh = 0;
  
  const detectStraight = (vals: number[]): { isSt: boolean; high: number } => {
    const tempVals = [...vals];
    if (vals.includes(14)) {
      tempVals.unshift(1); // Low Ace
    }
    const sorted = Array.from(new Set(tempVals)).sort((a,b) => a - b);
    for (let i = sorted.length - 1; i >= 4; i--) {
      if (sorted[i] - sorted[i-4] === 4 && new Set(sorted.slice(i-4, i+1)).size === 5) {
        return { isSt: true, high: sorted[i] };
      }
    }
    return { isSt: false, high: 0 };
  };

  const stCheck = detectStraight(uniqueRanks);
  isStraight = stCheck.isSt;
  straightHigh = stCheck.high;

  // Straight Flush detection
  let isStraightFlush = false;
  if (isSuitedFlush && isStraight) {
    const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] >= 5);
    if (flushSuit) {
      const flushCards = allCards.filter(c => c.suit === flushSuit);
      const flushRanks = flushCards.map(c => rankValues[c.rank]);
      const sfCheck = detectStraight(flushRanks);
      if (sfCheck.isSt) {
        isStraightFlush = true;
      }
    }
  }

  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const pairs = Object.keys(rankCounts).filter(r => rankCounts[r] === 2).map(r => rankValues[r]).sort((a, b) => b - a);
  const trips = Object.keys(rankCounts).filter(r => rankCounts[r] === 3).map(r => rankValues[r]).sort((a, b) => b - a);
  const quads = Object.keys(rankCounts).filter(r => rankCounts[r] === 4).map(r => rankValues[r]).sort((a, b) => b - a);

  // Draws
  let drawText = "";
  if (communityCards.length > 0 && communityCards.length < 5) {
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    const hasFlushDraw = maxSuitCount === 4;
    const hasBackdoorFlush = maxSuitCount === 3;

    let hasOesd = false;
    let hasGutshot = false;
    
    const checkStraightDraws = (vals: number[]) => {
      const temp = [...vals];
      if (vals.includes(14)) temp.unshift(1);
      const sorted = Array.from(new Set(temp)).sort((a,b) => a - b);
      
      let stDraws = 0;
      for (let rank = 2; rank <= 14; rank++) {
        if (!sorted.includes(rank)) {
          const simulated = [...sorted, rank].sort((a,b) => a - b);
          if (detectStraight(simulated).isSt) {
            stDraws++;
          }
        }
      }
      return stDraws;
    };

    const straightOuts = checkStraightDraws(uniqueRanks);
    if (straightOuts >= 8) {
      hasOesd = true;
    } else if (straightOuts >= 4) {
      hasGutshot = true;
    }

    if (hasFlushDraw && hasOesd) {
      drawText = "同花+兩頭順雙重強聽 (Combo Draw)";
    } else if (hasFlushDraw && hasGutshot) {
      drawText = "同花+卡順強聽牌 (Monster Draw)";
    } else if (hasFlushDraw) {
      drawText = "同花聽牌 (Flush Draw)";
    } else if (hasOesd) {
      drawText = "兩頭順聽牌 (OESD)";
    } else if (hasGutshot) {
      drawText = "內卡順聽牌 (Gutshot Draw)";
    } else if (hasBackdoorFlush) {
      drawText = "後門同花潛力";
    }
  }

  if (isStraightFlush) {
    return { name: "同花順 (Straight Flush)", level: 9, draw: drawText };
  }
  if (quads.length > 0) {
    return { name: "四條 (Four of a Kind)", level: 8, draw: drawText };
  }
  if (trips.length > 0 && (pairs.length > 0 || trips.length > 1)) {
    return { name: "葫蘆 (Full House)", level: 7, draw: drawText };
  }
  if (isSuitedFlush) {
    return { name: "同花 (Flush)", level: 6, draw: drawText };
  }
  if (isStraight) {
    return { name: "順子 (Straight)", level: 5, draw: drawText };
  }
  if (trips.length > 0) {
    return { name: "三條 (Three of a Kind)", level: 4, draw: drawText };
  }
  if (pairs.length >= 2) {
    return { name: "兩對 (Two Pairs)", level: 3, draw: drawText };
  }
  if (pairs.length === 1) {
    const pairRank = pairs[0];
    let pairType = "一對";
    if (communityCards.length > 0) {
      const commValues = communityCards.map(c => rankValues[c.rank]);
      const maxComm = Math.max(...commValues);
      const minComm = Math.min(...commValues);
      
      const isHolePair = holeCards.length === 2 && holeCards[0].rank === holeCards[1].rank;
      if (isHolePair) {
        if (pairRank > maxComm) {
          pairType = "超強超對 (Overpair)";
        } else {
          pairType = `口袋對子 (${holeCards[0].rank}${holeCards[1].rank})`;
        }
      } else {
        if (pairRank >= maxComm) {
          pairType = "頂對 (Top Pair)";
        } else if (pairRank <= minComm) {
          pairType = "底對 (Bottom Pair)";
        } else {
          pairType = "中對 (Middle Pair)";
        }
      }
    } else {
      const isHolePair = holeCards.length === 2 && holeCards[0].rank === holeCards[1].rank;
      if (isHolePair) {
        pairType = `口袋對子 (${holeCards[0].rank}${holeCards[1].rank})`;
      }
    }
    
    return { name: pairType, level: 2, draw: drawText };
  }
  
  let hcText = "高張 (High Card)";
  if (holeCards.length === 2 && communityCards.length > 0) {
    const commValues = communityCards.map(c => rankValues[c.rank]);
    const maxComm = Math.max(...commValues);
    const heroMax = Math.max(rankValues[holeCards[0].rank], rankValues[holeCards[1].rank]);
    const heroMin = Math.min(rankValues[holeCards[0].rank], rankValues[holeCards[1].rank]);
    
    if (heroMin > maxComm) {
      hcText = "兩張超張 (Two Overcards)";
    } else if (heroMax > maxComm) {
      hcText = "單張超張 (One Overcard)";
    }
  } else if (holeCards.length === 2 && communityCards.length === 0) {
    hcText = `高張 ${holeCards[0].rank}${holeCards[1].rank}`;
  }
  
  return { name: hcText, level: 1, draw: drawText };
};
