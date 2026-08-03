export const GTO_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export const UTG_COMBOS = new Set([
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66',
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
  'KQs', 'KJs', 'KTs', 'K9s', 'QJs', 'QTs', 'JTs', 'T9s', '98s', '87s', '76s',
  'AKo', 'AQo', 'AJo'
]);

export const CO_COMBOS = new Set([
  ...Array.from(UTG_COMBOS),
  '55', '44', '33', '22',
  'K8s', 'K7s', 'K6s', 'K5s',
  'Q9s', 'J9s', 'T8s', '97s', '86s', '75s', '65s', '54s',
  'ATo', 'KTo', 'KQo', 'KJo', 'QJo'
]);

export const BTN_COMBOS = new Set([
  ...Array.from(CO_COMBOS),
  'K4s', 'K3s', 'K2s',
  'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s',
  'J8s', 'J7s', 'J6s', 'J5s', 'J4s', 'J3s', 'J2s',
  'T7s', 'T6s', 'T5s', '96s', '95s', '85s', '84s',
  '74s', '64s', '53s', '43s',
  'A9o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o', 'A3o', 'A2o',
  'K9o', 'Q9o', 'J9o', 'T9o', '98o', '87o'
]);

export const SB_COMBOS = new Set([
  ...Array.from(BTN_COMBOS),
  'T4s', 'T3s', 'T2s', '94s', '93s', '92s',
  '83s', '82s', '73s', '72s', '63s', '62s', '52s',
  'K8o', 'K7o', 'K6o', 'K5o', 'Q8o', 'J8o', 'T8o', '97o', '86o', '76o'
]);

export const BB_COMBOS = new Set([
  ...Array.from(SB_COMBOS),
  'A4o', 'A3o', 'A2o',
  'K4o', 'K3o', 'K2o',
  'Q7o', 'Q6o', 'Q5o', 'J7o', 'T7o', '96o', '85o', '75o', '65o', '54o'
]);

// 9-Max Preflop RFI Ranges (Tighter for UTG/early positions)
export const NINE_UTG_COMBOS = new Set([
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77',
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
  'KQs', 'KJs', 'KTs', 'QTs', 'JTs', 'T9s',
  'AKo', 'AQo', 'AJo'
]);

export const NINE_UTG1_COMBOS = new Set([
  ...Array.from(NINE_UTG_COMBOS),
  '66', 'K9s', 'Q9s', 'KQo'
]);

export const NINE_UTG2_COMBOS = new Set([
  ...Array.from(NINE_UTG1_COMBOS),
  '55', 'J9s', 'T8s', '98s', 'ATo', 'KJo'
]);

export const NINE_MP_COMBOS = new Set([
  ...Array.from(NINE_UTG2_COMBOS),
  '44', '33', '22', 'K8s', 'Q8s', 'J8s', '87s', 'QJo'
]);

export const NINE_HJ_COMBOS = new Set([
  ...Array.from(NINE_MP_COMBOS),
  'K7s', 'K6s', 'K5s', 'J7s', 'T7s', '97s', '86s', '76s', 'KTo', 'QTo'
]);

export function isComboInGtoRange(combo: string, position: string, tableSize: '6max' | '9max'): boolean {
  const pos = position.toLowerCase().trim();
  if (tableSize === '9max') {
    if (pos === 'utg') return NINE_UTG_COMBOS.has(combo);
    if (pos === 'utg1' || pos === 'utg+1') return NINE_UTG1_COMBOS.has(combo);
    if (pos === 'utg2' || pos === 'utg+2') return NINE_UTG2_COMBOS.has(combo);
    if (pos === 'mp') return NINE_MP_COMBOS.has(combo);
    if (pos === 'hj') return NINE_HJ_COMBOS.has(combo);
    if (pos === 'co') return CO_COMBOS.has(combo);
    if (pos === 'btn') return BTN_COMBOS.has(combo);
    if (pos === 'sb') return SB_COMBOS.has(combo);
    if (pos === 'bb') return BB_COMBOS.has(combo);
    return false;
  } else {
    if (pos === 'utg') return UTG_COMBOS.has(combo);
    if (pos === 'hj' || pos === 'mp') return CO_COMBOS.has(combo); // In 6-max HJ is effectively the position before CO
    if (pos === 'co') return CO_COMBOS.has(combo);
    if (pos === 'btn') return BTN_COMBOS.has(combo);
    if (pos === 'sb') return SB_COMBOS.has(combo);
    if (pos === 'bb') return BB_COMBOS.has(combo);
    return false;
  }
}

export interface ComboMeta {
  combo: string;
  type: 'pair' | 'suited' | 'offsuit';
  combosCount: number;
  category: string;
  description: string;
  blockerNotes?: string;
}

export function getComboMeta(combo: string): ComboMeta {
  if (combo.length === 2) {
    // Pair
    const rank = combo[0];
    const highPairs = ['A', 'K', 'Q', 'J'];
    const midPairs = ['T', '9', '8', '7'];
    const category = highPairs.includes(rank) ? '超強對子 (Premium Value)' : midPairs.includes(rank) ? '中口袋對子 (Set Mine)' : '小口袋對子 (Low Pair)';
    const description = highPairs.includes(rank)
      ? '頂級強牌，任何位置均無條件加注，具備極高 Value 與 3-Bet / 4-Bet 價值。'
      : midPairs.includes(rank)
      ? '具備擊中三條 (Set) 的強大隱藏贏面，在大底池極具投機與跟注價值。'
      : '主要用於偷盲與擊中 Set 做多街獲利，在早期位置需適度控壓。';

    const blockerNotes = rank === 'A'
      ? '持有 AA 將阻擋對手 50% 的 AA/AK 組合。'
      : rank === 'K'
      ? '持有 KK 將阻擋對手 50% 的 KK/AK 組合。'
      : undefined;

    return { combo, type: 'pair', combosCount: 6, category, description, blockerNotes };
  } else if (combo.endsWith('s')) {
    // Suited
    const r1 = combo[0];
    const r2 = combo[1];
    const idx1 = GTO_RANKS.indexOf(r1);
    const idx2 = GTO_RANKS.indexOf(r2);
    const gap = Math.abs(idx2 - idx1);

    let category = '同花手牌 (Suited)';
    let description = '同花牌具備優異的翻牌後成牌與聽牌能力。';

    if (r1 === 'A') {
      if (['K', 'Q', 'J', 'T'].includes(r2)) {
        category = '高張同花 A (Suited Broadway)';
        description = '強勁的翻前開牌手牌，擊中頂對與大同花聽牌表現極佳。';
      } else {
        category = '輪狀同花 A (Wheel / Suited Ace)';
        description = '具備 A 阻擋牌效應與順子 (Wheel A-2-3-4-5) 潛力，適合做 5-Bet Bluff。';
      }
    } else if (gap === 1) {
      category = '同花連張 (Suited Connector)';
      description = '多街聽牌極具翻牌後隱藏贏面 (Implied Odds)，適合後位多街施壓。';
    } else if (['K', 'Q', 'J'].includes(r1) && ['Q', 'J', 'T', '9'].includes(r2)) {
      category = '高張同花 (Suited Broadway)';
      description = '高平滑度的翻牌後結構，易擊中優質兩對、順子或同花聽牌。';
    }

    const blockerNotes = (r1 === 'A' || r2 === 'A')
      ? '帶有 A 阻擋牌：將大幅降低敵方持有一頂級 A 牌 (AA/AK/AQ) 的機率。'
      : (r1 === 'K' || r2 === 'K')
      ? '帶有 K 阻擋牌：降低敵方 KK/AK 組合機率。'
      : undefined;

    return { combo, type: 'suited', combosCount: 4, category, description, blockerNotes };
  } else {
    // Offsuit
    const r1 = combo[0];
    const r2 = combo[1];
    let category = '非同花手牌 (Offsuit)';
    let description = '非同花牌型缺乏同花聽牌發展潛力，主要靠高牌值做 Value。';

    if (r1 === 'A' && ['K', 'Q', 'J'].includes(r2)) {
      category = '高張非同花 A (Offsuit Broadway)';
      description = '頂級高張牌，具備高 Value 與強力 Blocker 效果，但要注意踢腳被壓制。';
    } else if (['K', 'Q', 'J'].includes(r1) && ['Q', 'J', 'T'].includes(r2)) {
      category = '高張非同花 (Offsuit Broadway)';
      description = '中後位開牌手牌，在槍口 (UTG) 等早期位置通常需選擇棄牌。';
    }

    const blockerNotes = (r1 === 'A' || r2 === 'A')
      ? '帶有 A 阻擋牌：減少敵方 AA/AK 組合數。'
      : undefined;

    return { combo, type: 'offsuit', combosCount: 12, category, description, blockerNotes };
  }
}

export interface PositionRangeStats {
  totalCombos: number;
  percentage: string;
  pairCombos: number;
  suitedCombos: number;
  offsuitCombos: number;
  pairPct: string;
  suitedPct: string;
  offsuitPct: string;
}

export function calculateRangeStats(position: string, tableSize: '6max' | '9max'): PositionRangeStats {
  let pairCombos = 0;
  let suitedCombos = 0;
  let offsuitCombos = 0;

  for (let r1Idx = 0; r1Idx < GTO_RANKS.length; r1Idx++) {
    for (let r2Idx = 0; r2Idx < GTO_RANKS.length; r2Idx++) {
      const r1 = GTO_RANKS[r1Idx];
      const r2 = GTO_RANKS[r2Idx];
      let combo = '';
      let count = 0;
      if (r1Idx === r2Idx) {
        combo = `${r1}${r2}`;
        count = 6;
      } else if (r1Idx < r2Idx) {
        combo = `${r1}${r2}s`;
        count = 4;
      } else {
        combo = `${r2}${r1}o`;
        count = 12;
      }

      if (isComboInGtoRange(combo, position, tableSize)) {
        if (r1Idx === r2Idx) pairCombos += count;
        else if (r1Idx < r2Idx) suitedCombos += count;
        else offsuitCombos += count;
      }
    }
  }

  const totalCombos = pairCombos + suitedCombos + offsuitCombos;
  const percentage = (totalCombos / 1326 * 100).toFixed(1);

  return {
    totalCombos,
    percentage: `${percentage}%`,
    pairCombos,
    suitedCombos,
    offsuitCombos,
    pairPct: totalCombos > 0 ? (pairCombos / totalCombos * 100).toFixed(1) + '%' : '0%',
    suitedPct: totalCombos > 0 ? (suitedCombos / totalCombos * 100).toFixed(1) + '%' : '0%',
    offsuitPct: totalCombos > 0 ? (offsuitCombos / totalCombos * 100).toFixed(1) + '%' : '0%',
  };
}

