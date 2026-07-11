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
