import type { ActionType, HandAction, ScenarioStep, Street } from '../types';

export interface Lesson {
  key: string; title: string; topic: string; format: 'cash' | 'tournament'; depth: number;
  table?: '6max' | '9max'; position: string; cards: string; board?: string; street?: Street;
  pot: number; line: string; prompt: string; assumptions: string[];
  best: ActionType; answers: Partial<Record<ActionType, [number, string]>>; remember: string;
  heroStack?: number; villainStack?: number; actions?: HandAction[];
  potAccounting?: ScenarioStep['potAccounting'];
}

/** Contributions include blinds/ante once, and each later payment (not the cumulative raise-to). */
interface LessonAccounting {
  heroStart: number; villainStart: number;
  heroPaid: number[]; villainPaid: number[]; otherPaid: number[]; callCost?: number;
}

export function auditedLesson(lesson: Omit<Lesson, 'depth' | 'pot' | 'heroStack' | 'villainStack' | 'potAccounting'>, accounting: LessonAccounting): Lesson {
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const rounded = (value: number) => Math.round(value * 1e6) / 1e6;
  const heroStack = rounded(accounting.heroStart - sum(accounting.heroPaid));
  const villainStack = rounded(accounting.villainStart - sum(accounting.villainPaid));
  const contributionsBB = [...accounting.heroPaid, ...accounting.villainPaid, ...accounting.otherPaid];
  return { ...lesson, heroStack, villainStack, depth: Math.min(heroStack, villainStack),
    pot: rounded(sum(contributionsBB)), potAccounting: { contributionsBB, callCostBB: accounting.callCost ?? 0 } };
}

/** Fixed poker-action order is independent of author insertion order, scores and bestAction. */
export const PRACTICAL_ACTION_ORDER: readonly ActionType[] = ['Fold', 'Check', 'Call', 'Bet small', 'Bet half pot', 'Bet big', 'Raise', '3-bet', '4-bet (Raise)', 'All-in'];
