export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type ActionType = 'Fold' | 'Call' | 'Raise' | '3-bet' | '4-bet (Raise)' | 'All-in' | 'Check' | 'Bet small' | 'Bet half pot' | 'Bet big';

export interface Feedback {
  judgment: '正確' | '可接受' | '偏鬆' | '偏緊' | '錯誤';
  score: number;
  bestAction: ActionType;
  why: string;
  conceptualError: string;
  remember: string;
  nextStepId: string | 'next_hand';
}

export interface ScenarioStep {
  id: string;
  street: 'Preflop' | 'Flop' | 'Turn' | 'River';
  communityCards: Card[];
  description: string;
  potSize: number;
  spr?: number;
  potOdds?: string;
  options: ActionType[];
  feedbacks: Partial<Record<ActionType, Feedback>>;
}

export interface Scenario {
  id: string;
  title: string;
  category?: string[];
  difficulty: '新手' | '中階' | '進階';
  type: 'Tournament' | 'Cash Game';
  blinds: string;
  ante: boolean;
  tourneyInfo?: string;
  userStack: string;
  userBB: number;
  position: string;
  villainProfile?: string;
  heroImage?: string;
  holeCards: Card[];
  preAction: string;
  effectiveStack: string;
  steps: ScenarioStep[];
}

export interface HistoryItem {
  scenarioId: string;
  category: string[];
  score: number;
  judgment: string;
  timestamp: number;
}
