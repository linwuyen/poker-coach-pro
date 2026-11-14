import { historyForTrainingTrack, type TrainingTrack } from '../domain/trainingTrack';
import { RANGE_QUESTIONS } from '../features/range/data';
import type { RangeQuestion } from '../features/range/types';
import type { HistoryItem } from '../types';
import { currentDueReviews, makeMasteryKey } from './index';

export type DueDrillReview = {
  id: string;
  question: RangeQuestion;
  dueItems: HistoryItem[];
} & ({ kind: 'range' } | { kind: 'counterfactual'; dimension: 'bet-size' | 'range-width' });

/** Group due dimension schedules into the original tool/question, never a lookalike hand. */
export function buildDueDrillQueue(history: HistoryItem[], track: TrainingTrack, now = Date.now()): DueDrillReview[] {
  const groups = new Map<string, DueDrillReview>();
  for (const item of currentDueReviews(historyForTrainingTrack(history, track), now)) {
    if (item.trainingType !== 'range' && item.trainingType !== 'counterfactual') continue;
    const question = RANGE_QUESTIONS.find(question => item.scenarioId === `${item.trainingType}-${question.id}`
      && question.gameFormat === (track === 'cash' ? 'Cash' : 'MTT'));
    if (!question || !item.stepId) continue;
    let review: DueDrillReview;
    if (item.trainingType === 'range') {
      if (!['range-construction', 'equity-estimation', 'pot-odds', 'final-action'].includes(item.stepId)
        || item.masteryKey !== makeMasteryKey(item.scenarioId, item.stepId)) continue;
      review = { id: item.scenarioId, kind: 'range', question, dueItems: [] };
    } else {
      const dimension = (['bet-size', 'range-width'] as const).find(value => item.transferGroupId === `counterfactual-${question.id}-${value}`);
      if (!dimension || !(dimension === 'bet-size' ? ['size-0.5', 'size-1', 'size-1.75'] : ['range-tight', 'range-baseline', 'range-wide']).includes(item.stepId)
        || item.masteryKey !== makeMasteryKey(item.scenarioId, `${dimension}-${item.stepId}`)) continue;
      review = { id: item.transferGroupId!, kind: 'counterfactual', dimension, question, dueItems: [] };
    }
    const group = groups.get(review.id) || review;
    group.dueItems.push(item);
    groups.set(review.id, group);
  }
  return [...groups.values()].sort((a, b) => Math.min(...a.dueItems.map(item => item.nextReviewAt!)) - Math.min(...b.dueItems.map(item => item.nextReviewAt!)));
}
