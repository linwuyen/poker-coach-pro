export interface IcmPlayer { id: string; stack: number; }
export interface IcmResult { equities: Record<string, number>; totalPayout: number; }
export interface HeadsUpRiskInput {
  players: IcmPlayer[];
  payouts: number[];
  heroId: string;
  villainId: string;
  amountAtRisk: number;
  showdownEquity: number;
}
export interface HeadsUpRiskResult {
  foldEquity: number;
  callEquity: number;
  winEquity: number;
  loseEquity: number;
  dollarEvDelta: number;
  riskPremiumPercent: number;
  chipEvBreakEvenPercent: number;
  icmBreakEvenPercent: number;
}
export interface PkoRiskInput extends HeadsUpRiskInput {
  villainBountyValue: number;
  bountyCashFraction?: number;
}
export interface PkoRiskResult extends HeadsUpRiskResult {
  bountyEv: number;
  pkoCallEquity: number;
  pkoDollarEvDelta: number;
  pkoBreakEvenPercent: number;
  canEliminateVillain: boolean;
}

export interface FgsNode {
  id: string;
  /** Probability of this branch from its parent. Root probability is ignored. */
  probability?: number;
  /** Absolute chip state at this node. Omit to inherit the parent state. */
  players?: IcmPlayer[];
  children?: FgsNode[];
  note?: string;
}

export interface FgsInput {
  root: FgsNode;
  payouts: number[];
  heroId: string;
  maxNodes?: number;
}

export interface FgsResult {
  equities: Record<string, number>;
  heroEquity: number;
  totalPayout: number;
  nodeCount: number;
  leafCount: number;
  maxDepth: number;
}

export interface FgsActionTree {
  action: string;
  root: FgsNode;
}

export interface FgsActionResult extends FgsResult {
  action: string;
  deltaVsBest: number;
}

function clonePlayers(players: IcmPlayer[]): IcmPlayer[] { return players.map(player => ({ ...player })); }

function payoutEquities(players: IcmPlayer[], payouts: number[]): Record<string, number> {
  const equities = Object.fromEntries(players.map(player => [player.id, 0])) as Record<string, number>;
  const recurse = (remaining: IcmPlayer[], place: number, probability: number) => {
    if (!remaining.length || place >= payouts.length || probability <= 0) return;
    const total = remaining.reduce((sum, player) => sum + Math.max(0, player.stack), 0);
    if (total <= 0) return;
    remaining.forEach((player, index) => {
      const p = probability * Math.max(0, player.stack) / total;
      equities[player.id] += p * (payouts[place] || 0);
      recurse([...remaining.slice(0, index), ...remaining.slice(index + 1)], place + 1, p);
    });
  };
  recurse(players.filter(player => player.stack > 0), 0, 1);
  return equities;
}

export function calculateIcm(players: IcmPlayer[], payouts: number[]): IcmResult {
  if (!players.length) return { equities: {}, totalPayout: 0 };
  if (players.some(player => player.stack < 0 || !Number.isFinite(player.stack))) throw new Error('Stacks must be finite and non-negative.');
  const ids = new Set(players.map(player => player.id));
  if (ids.size !== players.length || players.some(player => !player.id)) throw new Error('Player ids must be unique and non-empty.');
  if (payouts.some(value => value < 0 || !Number.isFinite(value))) throw new Error('Payouts must be finite and non-negative.');
  return { equities: payoutEquities(players, payouts), totalPayout: payouts.reduce((sum, value) => sum + value, 0) };
}

export function satellitePayouts(seats: number, ticketValue = 1): number[] {
  const count = Math.max(0, Math.floor(seats));
  return Array.from({ length: count }, () => Math.max(0, ticketValue));
}

function resolveAllIn(players: IcmPlayer[], heroId: string, villainId: string, amount: number, heroWins: boolean): IcmPlayer[] {
  const next = clonePlayers(players);
  const hero = next.find(player => player.id === heroId);
  const villain = next.find(player => player.id === villainId);
  if (!hero || !villain) throw new Error('Hero and villain must exist.');
  const atRisk = Math.min(amount, hero.stack, villain.stack);
  if (heroWins) { hero.stack += atRisk; villain.stack -= atRisk; }
  else { hero.stack -= atRisk; villain.stack += atRisk; }
  return next;
}

export function calculateHeadsUpIcmRisk(input: HeadsUpRiskInput): HeadsUpRiskResult {
  const showdownEquity = Math.min(1, Math.max(0, input.showdownEquity));
  const current = calculateIcm(input.players, input.payouts).equities[input.heroId] || 0;
  const winPlayers = resolveAllIn(input.players, input.heroId, input.villainId, input.amountAtRisk, true);
  const losePlayers = resolveAllIn(input.players, input.heroId, input.villainId, input.amountAtRisk, false);
  const winEquity = calculateIcm(winPlayers, input.payouts).equities[input.heroId] || 0;
  const loseEquity = calculateIcm(losePlayers, input.payouts).equities[input.heroId] || 0;
  const denominator = winEquity - loseEquity;
  const icmBreakEven = denominator > 0 ? (current - loseEquity) / denominator : 1;
  const hero = input.players.find(player => player.id === input.heroId);
  const villain = input.players.find(player => player.id === input.villainId);
  if (!hero || !villain) throw new Error('Hero and villain must exist.');
  const risk = Math.min(input.amountAtRisk, hero.stack, villain.stack);
  const chipEvBreakEven = risk > 0 ? risk / (risk * 2) : 0;
  const callEquity = showdownEquity * winEquity + (1 - showdownEquity) * loseEquity;
  return {
    foldEquity: current,
    callEquity,
    winEquity,
    loseEquity,
    dollarEvDelta: callEquity - current,
    riskPremiumPercent: Math.max(0, (icmBreakEven - chipEvBreakEven) * 100),
    chipEvBreakEvenPercent: chipEvBreakEven * 100,
    icmBreakEvenPercent: Math.min(100, Math.max(0, icmBreakEven * 100)),
  };
}

export function calculateHeadsUpPkoRisk(input: PkoRiskInput): PkoRiskResult {
  const base = calculateHeadsUpIcmRisk(input);
  const hero = input.players.find(player => player.id === input.heroId);
  const villain = input.players.find(player => player.id === input.villainId);
  if (!hero || !villain) throw new Error('Hero and villain must exist.');
  const canEliminateVillain = input.amountAtRisk >= villain.stack && hero.stack >= villain.stack;
  const bountyCashFraction = Math.min(1, Math.max(0, input.bountyCashFraction ?? 1));
  const bountyValue = Math.max(0, input.villainBountyValue) * bountyCashFraction;
  const showdownEquity = Math.min(1, Math.max(0, input.showdownEquity));
  const bountyEv = canEliminateVillain ? showdownEquity * bountyValue : 0;
  const pkoCallEquity = base.callEquity + bountyEv;
  const winValue = base.winEquity + (canEliminateVillain ? bountyValue : 0);
  const denominator = winValue - base.loseEquity;
  const pkoBreakEven = denominator > 0 ? (base.foldEquity - base.loseEquity) / denominator : 1;
  return {
    ...base,
    bountyEv,
    pkoCallEquity,
    pkoDollarEvDelta: pkoCallEquity - base.foldEquity,
    pkoBreakEvenPercent: Math.min(100, Math.max(0, pkoBreakEven * 100)),
    canEliminateVillain,
  };
}

interface FgsAccumulator {
  nodeCount: number;
  leafCount: number;
  maxDepth: number;
  ids: Set<string>;
  objects: Set<FgsNode>;
}

function validateNodeState(players: IcmPlayer[], expectedIds?: Set<string>): Set<string> {
  calculateIcm(players, [1]);
  const ids = new Set(players.map(player => player.id));
  if (expectedIds && (ids.size !== expectedIds.size || [...expectedIds].some(id => !ids.has(id)))) {
    throw new Error('Every FGS state must preserve the same player ids; eliminated players stay with stack 0.');
  }
  return ids;
}

function addWeighted(target: Record<string, number>, source: Record<string, number>, weight: number): void {
  Object.entries(source).forEach(([id, value]) => { target[id] = (target[id] || 0) + value * weight; });
}

function evaluateFgsNode(
  node: FgsNode,
  inheritedPlayers: IcmPlayer[] | undefined,
  payouts: number[],
  accumulator: FgsAccumulator,
  expectedIds: Set<string> | undefined,
  depth: number,
  maxNodes: number,
): { equities: Record<string, number>; ids: Set<string> } {
  accumulator.nodeCount += 1;
  accumulator.maxDepth = Math.max(accumulator.maxDepth, depth);
  if (accumulator.nodeCount > maxNodes) throw new Error(`FGS tree exceeds maxNodes=${maxNodes}.`);
  if (!node.id || accumulator.ids.has(node.id)) throw new Error('FGS node ids must be unique and non-empty.');
  if (accumulator.objects.has(node)) throw new Error('FGS tree must be acyclic.');
  accumulator.ids.add(node.id);
  accumulator.objects.add(node);
  const players = node.players ? clonePlayers(node.players) : inheritedPlayers ? clonePlayers(inheritedPlayers) : undefined;
  if (!players) throw new Error(`FGS node ${node.id} has no chip state to inherit.`);
  const ids = validateNodeState(players, expectedIds);
  const children = node.children || [];
  if (!children.length) {
    accumulator.leafCount += 1;
    accumulator.objects.delete(node);
    return { equities: calculateIcm(players, payouts).equities, ids };
  }
  const probabilities = children.map(child => child.probability);
  if (probabilities.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error(`FGS children of ${node.id} require finite probabilities in [0,1].`);
  }
  const totalProbability = probabilities.reduce((sum, value) => sum + (value || 0), 0);
  if (Math.abs(totalProbability - 1) > 1e-6) throw new Error(`FGS children of ${node.id} probabilities must sum to 1.`);
  const equities = Object.fromEntries([...ids].map(id => [id, 0])) as Record<string, number>;
  children.forEach(child => {
    const evaluated = evaluateFgsNode(child, players, payouts, accumulator, ids, depth + 1, maxNodes);
    addWeighted(equities, evaluated.equities, child.probability || 0);
  });
  accumulator.objects.delete(node);
  return { equities, ids };
}

/**
 * Finite Game Simulation conditional on an explicit user/simulator supplied future-state tree.
 * This function does not invent future action probabilities. It applies exact ICM at leaves and
 * probability-weighted backward induction over the supplied chance/state branches.
 */
export function calculateFgs(input: FgsInput): FgsResult {
  if (!input.heroId) throw new Error('FGS heroId is required.');
  if (!input.root) throw new Error('FGS root is required.');
  if (!input.payouts.length) throw new Error('FGS payouts are required.');
  const accumulator: FgsAccumulator = { nodeCount: 0, leafCount: 0, maxDepth: 0, ids: new Set(), objects: new Set() };
  const evaluated = evaluateFgsNode(input.root, undefined, input.payouts, accumulator, undefined, 0, input.maxNodes ?? 1000);
  if (!evaluated.ids.has(input.heroId)) throw new Error(`FGS hero ${input.heroId} is absent from the tree state.`);
  return {
    equities: evaluated.equities,
    heroEquity: evaluated.equities[input.heroId] || 0,
    totalPayout: input.payouts.reduce((sum, value) => sum + value, 0),
    nodeCount: accumulator.nodeCount,
    leafCount: accumulator.leafCount,
    maxDepth: accumulator.maxDepth,
  };
}

export function compareFgsActions(actions: FgsActionTree[], payouts: number[], heroId: string): FgsActionResult[] {
  if (!actions.length) return [];
  const raw = actions.map(action => ({ action: action.action, ...calculateFgs({ root: action.root, payouts, heroId }) }));
  const best = Math.max(...raw.map(result => result.heroEquity));
  return raw
    .map(result => ({ ...result, deltaVsBest: result.heroEquity - best }))
    .sort((left, right) => right.heroEquity - left.heroEquity || left.action.localeCompare(right.action));
}
