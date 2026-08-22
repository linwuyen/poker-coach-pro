import { Card, Suit, Rank } from '../types';

const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

const STRAIGHT_PATTERNS: number[][] = [
  [14, 2, 3, 4, 5],
  [2, 3, 4, 5, 6], [3, 4, 5, 6, 7], [4, 5, 6, 7, 8], [5, 6, 7, 8, 9],
  [6, 7, 8, 9, 10], [7, 8, 9, 10, 11], [8, 9, 10, 11, 12], [9, 10, 11, 12, 13], [10, 11, 12, 13, 14],
];

function suitName(suit: Suit): string {
  return suit === 'spades' ? '黑桃 ♠' : suit === 'hearts' ? '紅心 ♥' : suit === 'diamonds' ? '方塊 ♦' : '梅花 ♣';
}

function heroStraightMissingRanks(holeCards: Card[], communityCards: Card[]): number[] {
  if (communityCards.length === 0 || communityCards.length >= 5) return [];
  const allRanks = new Set([...holeCards, ...communityCards].map(card => RANK_VALUE[card.rank]));
  const boardRanks = new Set(communityCards.map(card => RANK_VALUE[card.rank]));
  if (STRAIGHT_PATTERNS.some(pattern => pattern.every(rank => allRanks.has(rank)))) return [];

  const missing = new Set<number>();
  for (const pattern of STRAIGHT_PATTERNS) {
    const presentAll = pattern.filter(rank => allRanks.has(rank));
    const presentBoard = pattern.filter(rank => boardRanks.has(rank));
    // Board-only four-card runs do not count as Hero outs. Hero must contribute
    // at least one distinct rank to the four-card straight structure.
    if (presentAll.length === 4 && presentBoard.length < 4) {
      const absent = pattern.find(rank => !allRanks.has(rank));
      if (absent !== undefined) missing.add(absent);
    }
  }
  return [...missing];
}

export function analyzeHandMath(holeCards: Card[], communityCards: Card[], potOddsStr?: string) {
  const allCards = [...holeCards, ...communityCards];
  const suitCounts: Record<Suit, number> = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 };
  const holeSuitCounts: Record<Suit, number> = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 };
  allCards.forEach(card => { suitCounts[card.suit] += 1; });
  holeCards.forEach(card => { holeSuitCounts[card.suit] += 1; });

  let flushDrawSuit: Suit | undefined;
  let backdoorFlushSuit: Suit | undefined;
  (Object.keys(suitCounts) as Suit[]).forEach(suit => {
    const count = suitCounts[suit];
    // A four-flush entirely on the board is not a nine-out Hero flush draw.
    if (count === 4 && communityCards.length < 5 && holeSuitCounts[suit] > 0) flushDrawSuit = suit;
    else if (count === 3 && communityCards.length === 3 && holeSuitCounts[suit] > 0) backdoorFlushSuit = suit;
  });

  const straightMissingRanks = heroStraightMissingRanks(holeCards, communityCards);
  const straightDrawOuts = Math.min(2, straightMissingRanks.length) * 4;
  const straightDrawType = straightDrawOuts >= 8 ? '兩頭順聽牌 (OESD)' : straightDrawOuts === 4 ? '卡順聽牌 (Gutshot)' : '';
  const flushDrawOuts = flushDrawSuit ? 9 : 0;

  let totalOuts = 0;
  let outsDescription = '無明顯聽牌組合';
  if (flushDrawOuts > 0 && straightDrawOuts > 0) {
    // The card of the flush suit at each missing straight rank is shared by both
    // draw classes, so subtract the overlap rather than double-counting it.
    const overlap = straightMissingRanks.length;
    totalOuts = flushDrawOuts + straightDrawOuts - overlap;
    outsDescription = straightDrawOuts >= 8 ? '雙料超級強聽牌 (同花 + 兩頭順)' : '雙料強聽牌 (同花 + 卡順)';
  } else if (flushDrawOuts > 0 && flushDrawSuit) {
    totalOuts = flushDrawOuts;
    outsDescription = `同花聽牌 (${suitName(flushDrawSuit)})`;
  } else if (straightDrawOuts > 0) {
    totalOuts = straightDrawOuts;
    outsDescription = straightDrawType;
  } else if (backdoorFlushSuit) {
    outsDescription = `後門同花聽牌 (${suitName(backdoorFlushSuit)})`;
  }

  let hitProbNext = 0;
  let hitProbRiver = 0;
  if (totalOuts > 0 && communityCards.length < 5) {
    const unseen = 52 - allCards.length;
    hitProbNext = Math.round((totalOuts / unseen) * 100);
    if (communityCards.length === 3) {
      const turnMiss = (unseen - totalOuts) / unseen;
      const riverMiss = (unseen - 1 - totalOuts) / (unseen - 1);
      hitProbRiver = Math.round((1 - turnMiss * riverMiss) * 100);
    } else {
      hitProbRiver = hitProbNext;
    }
  }

  let potOddsNum = 0;
  if (potOddsStr) {
    const matched = potOddsStr.match(/(\d+(?:\.\d+)?)\s*%/);
    if (matched) potOddsNum = parseFloat(matched[1]);
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
  
  const detectStraight = (vals: number[]): { isSt: boolean; high: number } => {
    const tempVals = [...vals];
    if (vals.includes(14)) tempVals.unshift(1);
    const sorted = Array.from(new Set(tempVals)).sort((a,b) => a - b);
    for (let i = sorted.length - 1; i >= 4; i--) {
      if (sorted[i] - sorted[i-4] === 4 && new Set(sorted.slice(i-4, i+1)).size === 5) return { isSt: true, high: sorted[i] };
    }
    return { isSt: false, high: 0 };
  };

  const stCheck = detectStraight(uniqueRanks);
  const isStraight = stCheck.isSt;

  let isStraightFlush = false;
  if (isSuitedFlush && isStraight) {
    const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] >= 5);
    if (flushSuit) {
      const flushCards = allCards.filter(c => c.suit === flushSuit);
      const flushRanks = flushCards.map(c => rankValues[c.rank]);
      if (detectStraight(flushRanks).isSt) isStraightFlush = true;
    }
  }

  const pairs = Object.keys(rankCounts).filter(r => rankCounts[r] === 2).map(r => rankValues[r]).sort((a, b) => b - a);
  const trips = Object.keys(rankCounts).filter(r => rankCounts[r] === 3).map(r => rankValues[r]).sort((a, b) => b - a);
  const quads = Object.keys(rankCounts).filter(r => rankCounts[r] === 4).map(r => rankValues[r]).sort((a, b) => b - a);

  const drawAnalysis = analyzeHandMath(holeCards, communityCards);
  const drawText = drawAnalysis.drawDescription === '無明顯聽牌組合' ? '' : drawAnalysis.drawDescription;

  if (isStraightFlush) return { name: "同花順 (Straight Flush)", level: 9, draw: drawText };
  if (quads.length > 0) return { name: "四條 (Four of a Kind)", level: 8, draw: drawText };
  if (trips.length > 0 && (pairs.length > 0 || trips.length > 1)) return { name: "葫蘆 (Full House)", level: 7, draw: drawText };
  if (isSuitedFlush) return { name: "同花 (Flush)", level: 6, draw: drawText };
  if (isStraight) return { name: "順子 (Straight)", level: 5, draw: drawText };
  if (trips.length > 0) return { name: "三條 (Three of a Kind)", level: 4, draw: drawText };
  if (pairs.length >= 2) return { name: "兩對 (Two Pairs)", level: 3, draw: drawText };
  if (pairs.length === 1) {
    const pairRank = pairs[0];
    let pairType = "一對";
    if (communityCards.length > 0) {
      const commValues = communityCards.map(c => rankValues[c.rank]);
      const maxComm = Math.max(...commValues);
      const minComm = Math.min(...commValues);
      const isHolePair = holeCards.length === 2 && holeCards[0].rank === holeCards[1].rank;
      if (isHolePair) {
        if (pairRank > maxComm) pairType = "超強超對 (Overpair)";
        else pairType = `口袋對子 (${holeCards[0].rank}${holeCards[1].rank})`;
      } else {
        if (pairRank >= maxComm) pairType = "頂對 (Top Pair)";
        else if (pairRank <= minComm) pairType = "底對 (Bottom Pair)";
        else pairType = "中對 (Middle Pair)";
      }
    } else {
      const isHolePair = holeCards.length === 2 && holeCards[0].rank === holeCards[1].rank;
      if (isHolePair) pairType = `口袋對子 (${holeCards[0].rank}${holeCards[1].rank})`;
    }
    return { name: pairType, level: 2, draw: drawText };
  }
  
  let hcText = "高張 (High Card)";
  if (holeCards.length === 2 && communityCards.length > 0) {
    const commValues = communityCards.map(c => rankValues[c.rank]);
    const maxComm = Math.max(...commValues);
    const heroMax = Math.max(rankValues[holeCards[0].rank], rankValues[holeCards[1].rank]);
    const heroMin = Math.min(rankValues[holeCards[0].rank], rankValues[holeCards[1].rank]);
    if (heroMin > maxComm) hcText = "兩張超張 (Two Overcards)";
    else if (heroMax > maxComm) hcText = "單張超張 (One Overcard)";
  } else if (holeCards.length === 2 && communityCards.length === 0) {
    hcText = `高張 ${holeCards[0].rank}${holeCards[1].rank}`;
  }
  return { name: hcText, level: 1, draw: drawText };
};
