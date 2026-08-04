import { PartialActionFrequency, Position, StrategyProfile, StrategySpot } from './types';

const hands = (value: string): string[] => value.trim().split(/\s+/).filter(Boolean);
const source = {
  type: 'heuristic' as const,
  trustTier: 'heuristic-estimate' as const,
  label: '想高龍了節點教學基準',
  generatedAt: '2026-08-04',
  authoredBy: 'Poker Coach Pro',
  disclaimer: '此 Profile 用於示範節點、尺寸與資料契約，不是 solver 精確輸出。請勿把邊界頻率當成唯一正解。',
};

function ranges(actions: Array<[string[], PartialActionFrequency]>): Record<string, PartialActionFrequency> {
  const result: Record<string, PartialActionFrequency> = {};
  actions.forEach(([group, frequency]) => group.forEach(hand => { result[hand] = { ...frequency }; }));
  return result;
}

function profile(input: {
  id: string;
  name: string;
  spot: StrategySpot;
  position: Position;
  villainPosition?: Position;
  stackDepthBB: number;
  anteBB?: number;
  openSizeBB?: number;
  data: Record<string, PartialActionFrequency>;
  actionSizesBB?: StrategyProfile['actionSizesBB'];
  evByHand?: StrategyProfile['evByHand'];
  icmModel?: 'chip-ev' | 'icm';
}): StrategyProfile {
  return {
    schemaVersion: 2,
    id: input.id,
    version: '2.1.0',
    name: input.name,
    description: `${input.spot} 教學節點，${input.stackDepthBB}BB。`,
    context: {
      format: input.spot === 'push-fold' ? 'tournament' : 'cash',
      tableSize: input.spot === 'push-fold' ? '9max' : '6max',
      spot: input.spot,
      position: input.position,
      villainPosition: input.villainPosition,
      stackDepthBB: input.stackDepthBB,
      anteBB: input.anteBB || 0,
      openSizeBB: input.openSizeBB,
      rakePercent: input.spot === 'push-fold' ? 0 : 5,
      rakeCapBB: input.spot === 'push-fold' ? 0 : 2,
      betTree: {
        openSizesBB: input.openSizeBB ? [input.openSizeBB] : undefined,
        threeBetSizesBB: input.actionSizesBB?.raise,
        fourBetSizesBB: input.spot === '4bet' ? input.actionSizesBB?.raise : undefined,
        jamAllowed: true,
      },
      icm: input.spot === 'push-fold' ? { model: input.icmModel || 'chip-ev' } : undefined,
    },
    source,
    ranges: input.data,
    actionSizesBB: input.actionSizesBB,
    evByHand: input.evByHand,
    tags: ['baseline', input.spot, 'frequency-aware', 'v2'],
    immutable: true,
  };
}

const premiums = hands('AA KK QQ JJ TT AKs AQs AKo');

export const ADVANCED_STRATEGY_PROFILES: StrategyProfile[] = [
  profile({
    id: 'baseline-v2-cash-6max-100bb-bb-vs-btn-defense',
    name: '6-Max BB 對 BTN 開池防守',
    spot: 'bb-defense', position: 'bb', villainPosition: 'btn', stackDepthBB: 100, openSizeBB: 2.5,
    data: ranges([
      [hands('AA KK QQ JJ TT AKs AQs AKo A5s A4s'), { raise: 0.7, call: 0.3 }],
      [hands('99 88 77 66 55 44 33 22 AJs ATs A9s A8s A7s A6s A3s A2s KQs KJs KTs K9s QJs QTs Q9s JTs J9s T9s 98s 87s 76s 65s 54s AQo AJo ATo KQo KJo QJo'), { call: 1 }],
      [hands('K8s K7s K6s Q8s J8s T8s 97s 86s 75s 64s 53s A9o KTo QTo JTo'), { call: 0.55 }],
    ]),
    actionSizesBB: { raise: [10.5, 12] },
    evByHand: { A5s: { raise: 1.34, call: 1.28, fold: 0 }, K7s: { call: 0.41, fold: 0 } },
  }),
  profile({
    id: 'baseline-v2-cash-6max-100bb-btn-vs-co-open',
    name: '6-Max BTN 對 CO 開池',
    spot: 'vs-open', position: 'btn', villainPosition: 'co', stackDepthBB: 100, openSizeBB: 2.5,
    data: ranges([
      [premiums, { raise: 0.75, call: 0.25 }],
      [hands('99 88 77 66 AJs ATs A5s A4s KQs KJs QJs JTs T9s 98s AQo AJo KQo'), { call: 0.7, raise: 0.3 }],
      [hands('55 44 33 22 A9s A8s A7s A6s A3s A2s KTs K9s QTs Q9s J9s 87s 76s 65s 54s ATo KJo QJo'), { call: 0.45 }],
    ]),
    actionSizesBB: { raise: [8, 9] },
  }),
  profile({
    id: 'baseline-v2-cash-6max-100bb-sb-3bet-vs-btn',
    name: '6-Max SB 對 BTN 3-Bet',
    spot: '3bet', position: 'sb', villainPosition: 'btn', stackDepthBB: 100, openSizeBB: 2.5,
    data: ranges([
      [hands('AA KK QQ JJ TT AKs AQs AKo'), { raise: 1 }],
      [hands('99 AJs ATs A5s A4s KQs KJs AQo'), { raise: 0.65 }],
      [hands('88 77 66 A9s KTs QJs JTs T9s AJo KQo'), { call: 0.35, raise: 0.2 }],
    ]),
    actionSizesBB: { raise: [10.5, 12] },
    evByHand: { A5s: { raise: 1.02, call: 0.72, fold: 0 }, QQ: { raise: 4.8, call: 4.35 } },
  }),
  profile({
    id: 'baseline-v2-cash-6max-100bb-btn-4bet-vs-sb',
    name: '6-Max BTN 對 SB 3-Bet 的 4-Bet',
    spot: '4bet', position: 'btn', villainPosition: 'sb', stackDepthBB: 100, openSizeBB: 2.5,
    data: ranges([
      [hands('AA KK AKs AKo'), { raise: 0.75, call: 0.25 }],
      [hands('QQ JJ AQs'), { call: 0.7, raise: 0.3 }],
      [hands('TT 99 AJs KQs'), { call: 0.45 }],
      [hands('A5s A4s'), { raise: 0.35 }],
    ]),
    actionSizesBB: { raise: [22, 24], allIn: [100] },
  }),
  profile({
    id: 'baseline-v2-mtt-9max-15bb-btn-push-fold',
    name: '9-Max MTT BTN 15BB Push/Fold',
    spot: 'push-fold', position: 'btn', stackDepthBB: 15, anteBB: 0.125, icmModel: 'chip-ev',
    data: ranges([
      [hands('22 33 44 55 66 77 88 99 TT JJ QQ KK AA A2s A3s A4s A5s A6s A7s A8s A9s ATs AJs AQs AKs K8s K9s KTs KJs KQs Q9s QTs QJs J9s JTs T9s 98s A8o A9o ATo AJo AQo AKo KTo KJo KQo QJo'), { allIn: 1 }],
      [hands('K7s Q8s J8s T8s 87s 76s A7o K9o QTo JTo'), { allIn: 0.45 }],
    ]),
    actionSizesBB: { allIn: [15] },
  }),
  profile({
    id: 'baseline-v2-mtt-9max-12bb-sb-push-fold',
    name: '9-Max MTT SB 12BB Push/Fold',
    spot: 'push-fold', position: 'sb', villainPosition: 'bb', stackDepthBB: 12, anteBB: 0.125, icmModel: 'chip-ev',
    data: ranges([
      [hands('22 33 44 55 66 77 88 99 TT JJ QQ KK AA A2s A3s A4s A5s A6s A7s A8s A9s ATs AJs AQs AKs K2s K3s K4s K5s K6s K7s K8s K9s KTs KJs KQs Q5s Q6s Q7s Q8s Q9s QTs QJs J7s J8s J9s JTs T7s T8s T9s 97s 98s 87s 76s 65s A2o A3o A4o A5o A6o A7o A8o A9o ATo AJo AQo AKo K8o K9o KTo KJo KQo Q9o QTo QJo J9o JTo T9o'), { allIn: 1 }],
      [hands('Q4s J6s T6s 96s 86s 75s 54s K7o Q8o J8o T8o 98o 87o'), { allIn: 0.5 }],
    ]),
    actionSizesBB: { allIn: [12] },
  }),
];
