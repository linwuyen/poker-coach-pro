export interface IcmPlayer {
  id: string;
  stack: number;
  /** One-based finishing place for a player who already has stack 0. */
  eliminatedPlace?: number;
}
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
  /** Minimum acceptable equity; 0 when either action has equal value at every equity. */
  icmBreakEvenPercent: number;
  chipEvIndifferent: boolean;
  icmIndifferent: boolean;
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
  pkoIndifferent: boolean;
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

/** Relative roundoff tolerance, including very small payout denominations. */
function sameUtility(left: number, right: number): boolean {
  return Math.abs(left - right) <= Number.EPSILON * 32 * Math.max(Math.abs(left), Math.abs(right), Number.MIN_VALUE);
}

/** A single unspecified bust has an unambiguous place; multiple busts need history. */
function withEliminationPlaces(players: IcmPlayer[]): IcmPlayer[] {
  const next = clonePlayers(players);
  const activeCount = next.filter(player => player.stack > 0).length;
  if (!activeCount) throw new Error('A tournament state must retain at least one live player.');
  const usedPlaces = new Set<number>();
  for (const player of next) {
    if (player.eliminatedPlace === undefined) continue;
    if (player.stack > 0 || !Number.isInteger(player.eliminatedPlace) || player.eliminatedPlace <= activeCount || player.eliminatedPlace > next.length || usedPlaces.has(player.eliminatedPlace)) {
      throw new Error('eliminatedPlace must be a unique finishing place below every live player.');
    }
    usedPlaces.add(player.eliminatedPlace);
  }
  const unspecified = next.filter(player => player.stack === 0 && player.eliminatedPlace === undefined);
  if (unspecified.length > 1) throw new Error('Multiple eliminated players require explicit eliminatedPlace finishing order.');
  if (unspecified.length === 1) {
    const remainingPlaces = Array.from({ length: next.length - activeCount }, (_, index) => activeCount + index + 1).filter(place => !usedPlaces.has(place));
    unspecified[0].eliminatedPlace = remainingPlaces[0];
  }
  return next;
}

function payoutEquities(players: IcmPlayer[], payouts: number[]): Record<string, number> {
  const equities = Object.fromEntries(players.map(player => [player.id, player.eliminatedPlace === undefined ? 0 : payouts[player.eliminatedPlace - 1] || 0])) as Record<string, number>;
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
  if (payouts.length > players.length) throw new Error('Payouts cannot include more places than the supplied player roster.');
  return { equities: payoutEquities(withEliminationPlaces(players), payouts), totalPayout: payouts.reduce((sum, value) => sum + value, 0) };
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
  // Existing zero-stack players keep their earned place; the newly eliminated
  // player finishes immediately below the players alive before this contest.
  const eliminated = next.find(player => player.stack === 0 && player.eliminatedPlace === undefined);
  if (eliminated) eliminated.eliminatedPlace = players.filter(player => player.stack > 0).length;
  return next;
}

export function calculateHeadsUpIcmRisk(input: HeadsUpRiskInput): HeadsUpRiskResult {
  const hero = input.players.find(player => player.id === input.heroId);
  const villain = input.players.find(player => player.id === input.villainId);
  if (!hero || !villain || hero.id === villain.id || hero.stack <= 0 || villain.stack <= 0) throw new Error('Hero and villain must be distinct live players.');
  if (!Number.isFinite(input.amountAtRisk) || input.amountAtRisk < 0 || input.amountAtRisk > Math.min(hero.stack, villain.stack)) throw new Error('amountAtRisk must be finite and within the effective stack risk.');
  if (!Number.isFinite(input.showdownEquity) || input.showdownEquity < 0 || input.showdownEquity > 1) throw new Error('showdownEquity must be finite and in [0,1].');
  const showdownEquity = input.showdownEquity;
  const players = withEliminationPlaces(input.players);
  const current = calculateIcm(players, input.payouts).equities[input.heroId] || 0;
  const winPlayers = resolveAllIn(players, input.heroId, input.villainId, input.amountAtRisk, true);
  const losePlayers = resolveAllIn(players, input.heroId, input.villainId, input.amountAtRisk, false);
  const winEquity = calculateIcm(winPlayers, input.payouts).equities[input.heroId] || 0;
  const loseEquity = calculateIcm(losePlayers, input.payouts).equities[input.heroId] || 0;
  const denominator = winEquity - loseEquity;
  const icmIndifferent = sameUtility(winEquity, loseEquity) && sameUtility(current, loseEquity);
  const icmBreakEven = icmIndifferent ? 0 : denominator > 0 ? (current - loseEquity) / denominator : 1;
  const risk = Math.min(input.amountAtRisk, hero.stack, villain.stack);
  const chipEvBreakEven = risk > 0 ? risk / (risk * 2) : 0;
  const callEquity = icmIndifferent ? current : showdownEquity * winEquity + (1 - showdownEquity) * loseEquity;
  return {
    foldEquity: current,
    callEquity,
    winEquity,
    loseEquity,
    dollarEvDelta: callEquity - current,
    riskPremiumPercent: icmIndifferent ? 0 : Math.max(0, (icmBreakEven - chipEvBreakEven) * 100),
    chipEvBreakEvenPercent: chipEvBreakEven * 100,
    icmBreakEvenPercent: Math.min(100, Math.max(0, icmBreakEven * 100)),
    chipEvIndifferent: risk === 0,
    icmIndifferent,
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
  const pkoIndifferent = sameUtility(winValue, base.loseEquity) && sameUtility(base.foldEquity, base.loseEquity);
  const pkoBreakEven = pkoIndifferent ? 0 : denominator > 0 ? (base.foldEquity - base.loseEquity) / denominator : 1;
  return {
    ...base,
    bountyEv,
    pkoCallEquity,
    pkoDollarEvDelta: pkoCallEquity - base.foldEquity,
    pkoBreakEvenPercent: Math.min(100, Math.max(0, pkoBreakEven * 100)),
    pkoIndifferent,
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
  let players = node.players ? clonePlayers(node.players) : inheritedPlayers ? clonePlayers(inheritedPlayers) : undefined;
  if (!players) throw new Error(`FGS node ${node.id} has no chip state to inherit.`);
  const ids = validateNodeState(players, expectedIds);
  if (inheritedPlayers) {
    for (const prior of inheritedPlayers.filter(player => player.stack === 0)) {
      const current = players.find(player => player.id === prior.id)!;
      if (current.stack !== 0 || (current.eliminatedPlace !== undefined && current.eliminatedPlace !== prior.eliminatedPlace)) {
        throw new Error('An eliminated player must stay finished at the same eliminatedPlace.');
      }
      current.eliminatedPlace = prior.eliminatedPlace;
    }
  }
  players = withEliminationPlaces(players);
  calculateIcm(players, payouts);
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
    .map(result => ({ ...result, deltaVsBest: sameUtility(result.heroEquity, best) ? 0 : result.heroEquity - best }))
    .sort((left, right) => right.heroEquity - left.heroEquity || left.action.localeCompare(right.action));
}
