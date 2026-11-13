export interface IcmPlayer {
  id: string;
  stack: number;
  /** One-based finishing place for a player who already has stack 0. */
  eliminatedPlace?: number;
}
export interface IcmResult { equities: Record<string, number>; totalPayout: number; }
/** Bounds the exponential exact calculation before allocating subset tables. */
export const MAX_EXACT_ICM_PLAYERS = 16;
/** Conservative n*2^n work across distinct terminal states in one FGS request. */
export const MAX_FGS_EXACT_WORK = 4_000_000;
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
  const live = players.filter(player => player.stack > 0);
  // All finishing orders with the same remaining-player set have identical
  // next-place probabilities. Merge their probability mass once per subset:
  // O(n * 2^n) time / O(2^n) memory, rather than enumerating n! permutations.
  const stateCount = 1 << live.length;
  const stacks = new Float64Array(stateCount);
  const largestStack = new Float64Array(stateCount);
  const counts = new Uint8Array(stateCount);
  const probability = new Float64Array(stateCount);
  for (let mask = 1; mask < stateCount; mask += 1) {
    const bit = mask & -mask;
    const index = 31 - Math.clz32(bit);
    const rest = mask ^ bit;
    largestStack[mask] = Math.max(largestStack[rest], live[index].stack);
    // Normalize each subset independently, so both very large finite stacks
    // and tiny stacks remaining after a large stack wins retain valid shares.
    stacks[mask] = stacks[rest] * (largestStack[rest] / largestStack[mask]) + live[index].stack / largestStack[mask];
    counts[mask] = counts[mask ^ bit] + 1;
  }
  probability[stateCount - 1] = 1;
  for (let mask = stateCount - 1; mask > 0; mask -= 1) {
    const place = live.length - counts[mask];
    if (place >= payouts.length || !probability[mask]) continue;
    for (let remaining = mask; remaining; remaining &= remaining - 1) {
      const bit = remaining & -remaining;
      const player = live[31 - Math.clz32(bit)];
      const nextProbability = probability[mask] * (player.stack / largestStack[mask]) / stacks[mask];
      equities[player.id] += nextProbability * (payouts[place] || 0);
      probability[mask ^ bit] += nextProbability;
    }
  }
  return equities;
}

function validateIcmInputs(players: IcmPlayer[], payouts: number[]): void {
  if (players.some(player => player.stack < 0 || !Number.isFinite(player.stack))) throw new Error('Stacks must be finite and non-negative.');
  const ids = new Set(players.map(player => player.id));
  if (ids.size !== players.length || players.some(player => !player.id)) throw new Error('Player ids must be unique and non-empty.');
  if (payouts.some(value => value < 0 || !Number.isFinite(value))) throw new Error('Payouts must be finite and non-negative.');
  if (payouts.length > players.length) throw new Error('Payouts cannot include more places than the supplied player roster.');
  if (players.filter(player => player.stack > 0).length > MAX_EXACT_ICM_PLAYERS) throw new Error(`Exact ICM supports at most ${MAX_EXACT_ICM_PLAYERS} live players; keep the complete roster and use a larger-field model instead of omitting players.`);
}

export function calculateIcm(players: IcmPlayer[], payouts: number[]): IcmResult {
  if (!players.length) return { equities: {}, totalPayout: 0 };
  validateIcmInputs(players, payouts);
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

interface FgsWork {
  payouts: number[];
  states: Map<string, IcmPlayer[]>;
  equities: Map<string, Record<string, number>>;
  estimatedWork: number;
}

interface PreparedFgsNode {
  ids: Set<string>;
  probability: number;
  children: PreparedFgsNode[];
  equityKey?: string;
}

interface PreparedFgsInput {
  root: PreparedFgsNode;
  accumulator: FgsAccumulator;
  heroId: string;
}

function newFgsWork(payouts: number[]): FgsWork {
  return { payouts, states: new Map(), equities: new Map(), estimatedWork: 0 };
}

function registerFgsState(players: IcmPlayer[], work: FgsWork): string {
  // Roster order is immaterial; earned finishing places are part of utility.
  const key = JSON.stringify([...players].sort((left, right) => left.id.localeCompare(right.id)).map(player => [player.id, player.stack, player.eliminatedPlace ?? null]));
  if (!work.states.has(key)) {
    const liveCount = players.filter(player => player.stack > 0).length;
    work.estimatedWork += liveCount * 2 ** liveCount;
    if (work.estimatedWork > MAX_FGS_EXACT_WORK) throw new Error(`FGS exact computation work budget exceeded (${MAX_FGS_EXACT_WORK}); use a smaller explicit tree or an offline model. No partial result was calculated; do not omit players from a roster.`);
    work.states.set(key, players);
  }
  return key;
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

function prepareFgsNode(
  node: FgsNode,
  inheritedPlayers: IcmPlayer[] | undefined,
  work: FgsWork,
  accumulator: FgsAccumulator,
  expectedIds: Set<string> | undefined,
  depth: number,
  maxNodes: number,
): PreparedFgsNode {
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
  validateIcmInputs(players, work.payouts);
  players = withEliminationPlaces(players);
  const children = node.children || [];
  if (!children.length) {
    accumulator.leafCount += 1;
    accumulator.objects.delete(node);
    return { ids, probability: node.probability || 0, children: [], equityKey: registerFgsState(players, work) };
  }
  const probabilities = children.map(child => child.probability);
  if (probabilities.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error(`FGS children of ${node.id} require finite probabilities in [0,1].`);
  }
  const totalProbability = probabilities.reduce((sum, value) => sum + (value || 0), 0);
  if (Math.abs(totalProbability - 1) > 1e-6) throw new Error(`FGS children of ${node.id} probabilities must sum to 1.`);
  const preparedChildren = children.map(child => prepareFgsNode(child, players, work, accumulator, ids, depth + 1, maxNodes));
  accumulator.objects.delete(node);
  return { ids, probability: node.probability || 0, children: preparedChildren };
}

function prepareFgsInput(input: FgsInput, work: FgsWork): PreparedFgsInput {
  if (!input.heroId) throw new Error('FGS heroId is required.');
  if (!input.root) throw new Error('FGS root is required.');
  if (!input.payouts.length) throw new Error('FGS payouts are required.');
  const accumulator: FgsAccumulator = { nodeCount: 0, leafCount: 0, maxDepth: 0, ids: new Set(), objects: new Set() };
  const root = prepareFgsNode(input.root, undefined, work, accumulator, undefined, 0, input.maxNodes ?? 1000);
  if (!root.ids.has(input.heroId)) throw new Error(`FGS hero ${input.heroId} is absent from the tree state.`);
  return { root, accumulator, heroId: input.heroId };
}

function evaluatePreparedFgsNode(node: PreparedFgsNode, work: FgsWork): Record<string, number> {
  if (node.equityKey !== undefined) {
    let equities = work.equities.get(node.equityKey);
    if (!equities) {
      equities = payoutEquities(work.states.get(node.equityKey)!, work.payouts);
      work.equities.set(node.equityKey, equities);
    }
    return equities;
  }
  const equities = Object.fromEntries([...node.ids].map(id => [id, 0])) as Record<string, number>;
  for (const child of node.children) addWeighted(equities, evaluatePreparedFgsNode(child, work), child.probability);
  return equities;
}

function evaluatePreparedFgs(input: PreparedFgsInput, work: FgsWork): FgsResult {
  const equities = evaluatePreparedFgsNode(input.root, work);
  return {
    equities: { ...equities },
    heroEquity: equities[input.heroId] || 0,
    totalPayout: work.payouts.reduce((sum, value) => sum + value, 0),
    nodeCount: input.accumulator.nodeCount,
    leafCount: input.accumulator.leafCount,
    maxDepth: input.accumulator.maxDepth,
  };
}

/**
 * Finite Game Simulation conditional on an explicit user/simulator supplied future-state tree.
 * Validate the full tree and its shared exact-work budget before numerical evaluation.
 * Each distinct leaf state uses exact ICM once; supplied probabilities are never invented.
 */
export function calculateFgs(input: FgsInput): FgsResult {
  const work = newFgsWork(input.payouts);
  return evaluatePreparedFgs(prepareFgsInput(input, work), work);
}

export function compareFgsActions(actions: FgsActionTree[], payouts: number[], heroId: string): FgsActionResult[] {
  if (!actions.length) return [];
  const work = newFgsWork(payouts);
  // All actions share one budget/cache and complete preflight before any ICM.
  const prepared = actions.map(action => ({ action: action.action, input: prepareFgsInput({ root: action.root, payouts, heroId }, work) }));
  const raw = prepared.map(action => ({ action: action.action, ...evaluatePreparedFgs(action.input, work) }));
  const best = Math.max(...raw.map(result => result.heroEquity));
  return raw
    .map(result => ({ ...result, deltaVsBest: sameUtility(result.heroEquity, best) ? 0 : result.heroEquity - best }))
    .sort((left, right) => right.heroEquity - left.heroEquity || left.action.localeCompare(right.action));
}
