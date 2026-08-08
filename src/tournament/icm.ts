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
  if (players.some(player => player.stack < 0)) throw new Error('Stacks must be non-negative.');
  const ids = new Set(players.map(player => player.id));
  if (ids.size !== players.length) throw new Error('Player ids must be unique.');
  if (payouts.some(value => value < 0)) throw new Error('Payouts must be non-negative.');
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
