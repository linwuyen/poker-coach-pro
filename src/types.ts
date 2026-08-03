export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Street = 'Preflop' | 'Flop' | 'Turn' | 'River';

export interface HandAction {
  street: Street;
  seat: string;
  action: string;
  amountBB?: number;
  label?: string;
}

export interface HandState {
  tableSize?: '6max' | '9max';
  potSizeBB: number;
  heroStackBB?: number;
  villainStackBB?: number;
  actions: HandAction[];
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
  street: Street;
  communityCards: Card[];
  description: string;
  potSize: number;
  spr?: number;
  potOdds?: string;
  options: ActionType[];
  feedbacks: Partial<Record<ActionType, Feedback>>;
  handState?: HandState;
  assumptions?: string[];
  strategySource?: string;
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
  reviewSourceId?: string;
}

export interface HistoryItem {
  schemaVersion?: 3;
  attemptId?: string;
  trainingType?: 'scenario' | 'gto' | 'custom';
  scenarioId: string;
  stepId?: string;
  category: string[];
  score: number;
  judgment: string;
  timestamp: number;
  selectedAction?: string;
  bestAction?: string;
  street?: Street;
  position?: string;
  durationMs?: number;
  isReview?: boolean;
  nextReviewAt?: number;
  reviewIntervalDays?: number;
  questionLabel?: string;
  notes?: string;
  aiAnalysis?: string;
}
