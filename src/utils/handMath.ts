import { Card, Suit, Rank } from '../types';
import { cardKey, createDeck, evaluateHoldem } from '../poker/equityEngine';

const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

function suitName(suit: Suit): string {
  return suit === 'spades' ? '黑桃 ♠' : suit === 'hearts' ? '紅心 ♥' : suit === 'diamonds' ? '方塊 ♦' : '梅花 ♣';
}

function compareScores(left: number[], right: number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

/** Incomplete preflop/board displays still have ranks, but cannot form a five-card hand. */
function visibleScore(cards: Card[]): number[] {
  if (cards.length >= 5) return evaluateHoldem(cards);
  const counts = new Map<number, number>();
  cards.forEach(card => counts.set(RANK_VALUE[card.rank], (counts.get(RANK_VALUE[card.rank]) || 0) + 1));
  const groups = [...counts].sort((left, right) => right[1] - left[1] || right[0] - left[0]);
  const category = groups[0]?.[1] === 4 ? 7 : groups[0]?.[1] === 3 ? 3 : groups[0]?.[1] === 2 ? groups[1]?.[1] === 2 ? 2 : 1 : 0;
  return [category, ...groups.map(([rank]) => rank)];
}

export function analyzeHandMath(holeCards: Card[], communityCards: Card[], potOddsStr?: string) {
  const allCards = [...holeCards, ...communityCards];
  const outsByType = { straight: 0, flush: 0, straightFlush: 0, flushUpgrade: 0 };
  const outCards: string[] = [];
  const straightRanks = new Set<number>();
  const descriptions: string[] = [];
  let backdoorFlushSuit: Suit | undefined;
  let currentCategory = 0;

  if (holeCards.length === 2 && (communityCards.length === 3 || communityCards.length === 4)) {
    const current = evaluateHoldem(allCards);
    currentCategory = current[0];
    const known = new Set(allCards.map(cardKey));
    for (const card of createDeck()) {
      if (known.has(cardKey(card))) continue;
      const nextBoard = [...communityCards, card];
      const next = evaluateHoldem([...holeCards, ...nextBoard]);
      // Only straight/flush structure improvements are reported, not every new
      // pair/kicker, and never a weaker straight beneath an already-made flush.
      if (![4, 5, 8].includes(next[0]) || compareScores(next, current) <= 0) continue;
      // A complete board that ties Hero is not a Hero-contributed improvement.
      if (nextBoard.length === 5 && compareScores(next, evaluateHoldem(nextBoard)) <= 0) continue;
      if (next[0] === 8) outsByType.straightFlush += 1;
      else if (next[0] === 5) {
        if (current[0] === 5) outsByType.flushUpgrade += 1;
        else outsByType.flush += 1;
      } else outsByType.straight += 1;
      if (next[0] === 4 || next[0] === 8) straightRanks.add(RANK_VALUE[card.rank]);
      outCards.push(cardKey(card));
    }
    if (communityCards.length === 3 && current[0] < 5) {
      for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]) {
        if (allCards.filter(card => card.suit === suit).length === 3 && holeCards.some(card => card.suit === suit)) backdoorFlushSuit = suit;
      }
    }
  }

  if (outsByType.straightFlush) descriptions.push(`同花順聽牌 (Straight Flush) ${outsByType.straightFlush} outs`);
  if (outsByType.flush) descriptions.push(`同花聽牌 (Flush) ${outsByType.flush} outs`);
  if (outsByType.flushUpgrade) descriptions.push(`同花升級 ${outsByType.flushUpgrade} outs`);
  if (outsByType.straight) {
    const ranks = new Set(allCards.map(card => RANK_VALUE[card.rank]));
    const openEnded = Array.from({ length: 9 }, (_, index) => index + 2).some(start =>
      [start, start + 1, start + 2, start + 3].every(rank => ranks.has(rank)) &&
      straightRanks.has(start === 2 ? 14 : start - 1) && straightRanks.has(start + 4));
    const label = currentCategory === 4 ? '順子升級' : openEnded ? '兩頭順聽牌 (OESD)' : straightRanks.size >= 2 ? '雙卡順聽牌 (Double Gutshot)' : '卡順聽牌 (Gutshot)';
    descriptions.push(`${label} ${outsByType.straight} outs`);
  }
  const totalOuts = outCards.length;
  const outsDescription = descriptions.length ? `${descriptions.join(' + ')}；機率只計命中目前所列補牌，非攤牌勝率` : backdoorFlushSuit ? `後門同花聽牌 (${suitName(backdoorFlushSuit)})` : '無明顯聽牌組合';

  let hitProbNext = 0;
  let hitProbRiver = 0;
  if (totalOuts > 0) {
    const unseen = 52 - allCards.length;
    hitProbNext = Math.round((totalOuts / unseen) * 100);
    // This is the chance of seeing at least one of the CURRENT listed cards.
    // It is not showdown equity, clean winning outs, or a changing-runout model.
    hitProbRiver = communityCards.length === 3
      ? Math.round((1 - (unseen - totalOuts) / unseen * (unseen - 1 - totalOuts) / (unseen - 1)) * 100)
      : hitProbNext;
  }
  const matched = potOddsStr?.match(/(\d+(?:\.\d+)?)\s*%/);
  return {
    hasDraw: totalOuts > 0,
    outs: totalOuts,
    outCards,
    outsByType,
    drawDescription: outsDescription,
    hitProbNext,
    hitProbRiver,
    potOdds: matched ? parseFloat(matched[1]) : 0,
  };
}

export const evaluateHandStrength = (holeCards: Card[], communityCards: Card[]): { name: string; level: number; draw?: string } => {
  const allCards = [...holeCards, ...communityCards];
  if (!allCards.length) return { name: '未知', level: 0 };
  const score = visibleScore(allCards);
  const level = score[0] + 1;
  const analysis = analyzeHandMath(holeCards, communityCards);
  const draw = analysis.drawDescription === '無明顯聽牌組合' ? '' : analysis.drawDescription;
  const names = ['高張 (High Card)', '一對 (One Pair)', '兩對 (Two Pairs)', '三條 (Three of a Kind)', '順子 (Straight)', '同花 (Flush)', '葫蘆 (Full House)', '四條 (Four of a Kind)', '同花順 (Straight Flush)'];
  let name = names[score[0]];
  // Compare the full score (including kickers), not just hand categories. Low
  // hole pairs or low suited cards can be absent from Hero's best five entirely.
  if (communityCards.length === 5 && compareScores(score, evaluateHoldem(communityCards)) === 0) {
    return { name: `${name} · 公共牌成牌 (Playing the board)`, level, draw };
  }
  if (score[0] === 1) {
    const pairRank = score[1];
    const isHolePair = holeCards.length === 2 && holeCards[0].rank === holeCards[1].rank;
    if (!holeCards.some(card => RANK_VALUE[card.rank] === pairRank)) name = '公共牌一對 (Board Pair)';
    else if (isHolePair) {
      name = communityCards.length && pairRank > Math.max(...communityCards.map(card => RANK_VALUE[card.rank]))
        ? '超強超對 (Overpair)' : `口袋對子 (${holeCards[0].rank}${holeCards[1].rank})`;
    } else if (communityCards.length) {
      const boardRanks = communityCards.map(card => RANK_VALUE[card.rank]);
      name = pairRank === Math.max(...boardRanks) ? '頂對 (Top Pair)' : pairRank === Math.min(...boardRanks) ? '底對 (Bottom Pair)' : '中對 (Middle Pair)';
    }
  } else if (score[0] === 3 && communityCards.filter(card => RANK_VALUE[card.rank] === score[1]).length === 3) name = '公共牌三條 (Board Trips)';
  else if (score[0] === 0 && holeCards.length === 2) {
    if (!communityCards.length) name = `高張 ${holeCards[0].rank}${holeCards[1].rank}`;
    else {
      const maxBoard = Math.max(...communityCards.map(card => RANK_VALUE[card.rank]));
      const heroRanks = holeCards.map(card => RANK_VALUE[card.rank]);
      if (Math.min(...heroRanks) > maxBoard) name = '兩張超張 (Two Overcards)';
      else if (Math.max(...heroRanks) > maxBoard) name = '單張超張 (One Overcard)';
    }
  }
  return { name, level, draw };
};
