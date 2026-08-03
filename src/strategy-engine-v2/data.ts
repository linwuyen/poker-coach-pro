import { PartialActionFrequency, Position, StrategyProfile, TableSize } from './types';

const hands = (value: string): string[] => value.trim().split(/\s+/).filter(Boolean);
const unique = (...groups: string[][]): string[] => [...new Set(groups.flat())];

const premium = hands('AA KK QQ JJ TT AKs AQs AKo');
const sixUtg = unique(
  premium,
  hands('99 88 77 66 AJs ATs A5s A4s KQs KJs KTs QJs QTs JTs T9s 98s 87s 76s AQo AJo KQo'),
);
const sixHj = unique(
  sixUtg,
  hands('55 44 A9s A8s A7s A6s A3s A2s K9s Q9s J9s T8s 97s 86s 75s 65s 54s ATo KJo QJo'),
);
const sixCo = unique(
  sixHj,
  hands('33 22 K8s K7s K6s K5s K4s Q8s J8s T7s 96s 85s 74s 64s 53s 43s A9o KTo QTo JTo'),
);
const sixBtn = unique(
  sixCo,
  hands('K3s K2s Q7s Q6s Q5s Q4s Q3s Q2s J7s J6s J5s J4s J3s J2s T6s T5s T4s T3s T2s 95s 94s 84s 83s 73s 63s 52s 42s 32s A8o A7o A6o A5o A4o A3o A2o K9o K8o Q9o Q8o J9o J8o T9o T8o 98o 87o 76o 65o'),
);
const sixSbRaise = unique(
  sixCo,
  hands('K3s K2s Q7s Q6s J7s J6s T6s T5s 95s 85s 75s 64s 54s A8o A7o A6o A5o K9o Q9o J9o T9o'),
);
const sixSbLimp = unique(
  hands('22 33 44 55 66 A4s A3s A2s K8s K7s K6s K5s K4s Q8s Q5s Q4s Q3s Q2s J8s J5s J4s J3s J2s T8s T7s T4s T3s T2s 98s 97s 96s 94s 93s 87s 86s 84s 83s 76s 74s 73s 65s 63s 62s 53s 52s 43s 42s 32s A4o A3o A2o K8o K7o Q8o J8o T8o 98o 87o 76o 65o 54o'),
);

const nineUtg = unique(
  premium,
  hands('99 88 77 AJs ATs A5s A4s KQs KJs KTs QJs QTs JTs T9s AQo AJo'),
);
const nineUtg1 = unique(nineUtg, hands('66 A9s A8s A3s K9s 98s 87s KQo'));
const nineUtg2 = unique(nineUtg1, hands('55 A7s A6s A2s Q9s J9s T8s 76s ATo KJo'));
const nineMp = unique(nineUtg2, hands('44 33 22 K8s Q8s J8s 97s 86s 65s 54s QJo'));
const nineHj = unique(nineMp, hands('K7s K6s K5s Q7s J7s T7s 75s 64s 53s KTo QTo JTo'));
const nineCo = unique(nineHj, hands('K4s K3s Q6s Q5s J6s T6s 96s 85s 74s 63s A9o A8o K9o Q9o J9o T9o'));
const nineBtn = unique(
  nineCo,
  hands('K2s Q4s Q3s Q2s J5s J4s J3s J2s T5s T4s T3s T2s 95s 94s 84s 83s 73s 62s 52s 43s 42s 32s A7o A6o A5o A4o A3o A2o K8o K7o Q8o J8o T8o 98o 87o 76o 65o'),
);
const nineSbRaise = unique(nineCo, hands('K2s Q4s Q3s J5s J4s T5s T4s 95s 85s 75s 64s 54s A7o A6o A5o K8o Q8o J8o T8o'));
const nineSbLimp = unique(
  hands('22 33 44 55 66 A4s A3s A2s K7s K6s K5s K4s K3s Q7s Q6s Q5s Q4s Q3s Q2s J7s J6s J5s J4s J3s J2s T7s T6s T5s T4s T3s T2s 97s 96s 95s 94s 87s 86s 85s 84s 76s 75s 74s 65s 64s 63s 54s 53s 52s 43s 42s 32s A4o A3o A2o K7o K6o Q7o J7o T7o 97o 87o 76o 65o 54o'),
);

function createRanges(
  raiseHands: string[],
  mixed: Record<string, PartialActionFrequency> = {},
  callHands: string[] = [],
): Record<string, PartialActionFrequency> {
  const ranges: Record<string, PartialActionFrequency> = {};
  raiseHands.forEach(hand => { ranges[hand] = { raise: 1 }; });
  callHands.forEach(hand => { if (!ranges[hand]) ranges[hand] = { call: 1 }; });
  Object.entries(mixed).forEach(([hand, frequencies]) => { ranges[hand] = frequencies; });
  return ranges;
}

const source = {
  type: 'heuristic' as const,
  label: 'Poker Coach Baseline Model',
  generatedAt: '2026-08-04',
  disclaimer: '教學用基準策略，不是特定 solver、抽水結構或錦標賽節點的精確輸出。',
};

function profile(
  tableSize: TableSize,
  position: Position,
  format: 'cash' | 'tournament',
  stackDepthBB: number,
  anteBB: number,
  raiseHands: string[],
  mixed: Record<string, PartialActionFrequency> = {},
  callHands: string[] = [],
): StrategyProfile {
  const id = `baseline-v2-${format}-${tableSize}-${stackDepthBB}bb-${position}-rfi`;
  return {
    schemaVersion: 2,
    id,
    version: '2.0.0',
    name: `${tableSize.toUpperCase()} ${position.toUpperCase()} RFI 基準`,
    description: `未開池情境，${stackDepthBB}BB 有效籌碼的教學用頻率策略。`,
    context: {
      format,
      tableSize,
      spot: 'rfi',
      position,
      stackDepthBB,
      anteBB,
      openSizeBB: format === 'cash' ? 2.5 : 2.2,
    },
    source,
    ranges: createRanges(raiseHands, mixed, callHands),
    tags: ['baseline', 'rfi', 'frequency-aware', 'v2'],
  };
}

export const STRATEGY_PROFILES_V2: StrategyProfile[] = [
  profile('6max', 'utg', 'cash', 100, 0, sixUtg, {
    '66': { raise: 0.5 }, 'AJo': { raise: 0.5 }, 'K9s': { raise: 0.5 }, '76s': { raise: 0.5 },
  }),
  profile('6max', 'hj', 'cash', 100, 0, sixHj, {
    '44': { raise: 0.5 }, 'A9o': { raise: 0.35 }, 'KJo': { raise: 0.65 }, '75s': { raise: 0.5 },
  }),
  profile('6max', 'co', 'cash', 100, 0, sixCo, {
    '22': { raise: 0.65 }, 'A8o': { raise: 0.5 }, 'K9o': { raise: 0.4 }, '43s': { raise: 0.5 },
  }),
  profile('6max', 'btn', 'cash', 100, 0, sixBtn, {
    'K7o': { raise: 0.5 }, 'Q7o': { raise: 0.4 }, 'J7o': { raise: 0.3 }, '54o': { raise: 0.25 }, '42s': { raise: 0.5 },
  }),
  profile('6max', 'sb', 'cash', 100, 0, sixSbRaise, {
    '22': { raise: 0.35, call: 0.65 },
    '33': { raise: 0.4, call: 0.6 },
    'A4s': { raise: 0.6, call: 0.4 },
    'K7s': { raise: 0.5, call: 0.5 },
    'Q5s': { raise: 0.35, call: 0.65 },
    '76s': { raise: 0.4, call: 0.6 },
    '54s': { raise: 0.45, call: 0.55 },
  }, sixSbLimp),

  profile('9max', 'utg', 'tournament', 40, 0.125, nineUtg, {
    '77': { raise: 0.65 }, 'AJo': { raise: 0.4 }, 'A5s': { raise: 0.75 }, 'T9s': { raise: 0.5 },
  }),
  profile('9max', 'utg1', 'tournament', 40, 0.125, nineUtg1, {
    '66': { raise: 0.6 }, 'KQo': { raise: 0.5 }, '87s': { raise: 0.4 },
  }),
  profile('9max', 'utg2', 'tournament', 40, 0.125, nineUtg2, {
    '55': { raise: 0.55 }, 'ATo': { raise: 0.5 }, 'KJo': { raise: 0.45 }, '76s': { raise: 0.5 },
  }),
  profile('9max', 'mp', 'tournament', 40, 0.125, nineMp, {
    '22': { raise: 0.4 }, 'QJo': { raise: 0.6 }, '54s': { raise: 0.45 },
  }),
  profile('9max', 'hj', 'tournament', 40, 0.125, nineHj, {
    'KTo': { raise: 0.55 }, 'QTo': { raise: 0.45 }, '53s': { raise: 0.5 },
  }),
  profile('9max', 'co', 'tournament', 40, 0.125, nineCo, {
    'A8o': { raise: 0.55 }, 'K9o': { raise: 0.45 }, '74s': { raise: 0.4 },
  }),
  profile('9max', 'btn', 'tournament', 40, 0.125, nineBtn, {
    'K7o': { raise: 0.45 }, 'Q7o': { raise: 0.35 }, 'J7o': { raise: 0.25 }, '42s': { raise: 0.5 },
  }),
  profile('9max', 'sb', 'tournament', 40, 0.125, nineSbRaise, {
    '22': { raise: 0.35, call: 0.65 },
    'A4s': { raise: 0.55, call: 0.45 },
    'K7s': { raise: 0.45, call: 0.55 },
    'Q6s': { raise: 0.35, call: 0.65 },
    '65s': { raise: 0.4, call: 0.6 },
  }, nineSbLimp),
];
