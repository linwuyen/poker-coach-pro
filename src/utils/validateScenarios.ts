import { ActionType, Scenario } from '../types';

const expectedBoardCount = { Preflop: 0, Flop: 3, Turn: 4, River: 5 } as const;

export function validateScenarios(scenarios: Scenario[]): string[] {
  const errors: string[] = [];
  const scenarioIds = new Set<string>();

  for (const scenario of scenarios) {
    const prefix = `Scenario ${scenario.id || '(missing id)'}`;
    if (scenarioIds.has(scenario.id)) errors.push(`${prefix}: duplicate scenario id`);
    scenarioIds.add(scenario.id);
    if (!scenario.title.trim()) errors.push(`${prefix}: missing title`);
    if (scenario.holeCards.length !== 2) errors.push(`${prefix}: must have exactly two hole cards`);
    if (!scenario.steps.length) errors.push(`${prefix}: must have at least one step`);

    const stepIds = new Set<string>();
    scenario.steps.forEach(step => {
      const stepPrefix = `${prefix}, step ${step.id || '(missing id)'}`;
      if (stepIds.has(step.id)) errors.push(`${stepPrefix}: duplicate step id`);
      stepIds.add(step.id);
      if (step.communityCards.length !== expectedBoardCount[step.street]) {
        errors.push(`${stepPrefix}: ${step.street} requires ${expectedBoardCount[step.street]} community cards, got ${step.communityCards.length}`);
      }

      const cards = [...scenario.holeCards, ...step.communityCards].map(card => `${card.rank}-${card.suit}`);
      if (new Set(cards).size !== cards.length) errors.push(`${stepPrefix}: duplicate physical card`);
      if (!Number.isFinite(step.potSize) || step.potSize <= 0) errors.push(`${stepPrefix}: potSize must be positive`);
      if (new Set(step.options).size !== step.options.length) errors.push(`${stepPrefix}: duplicate options`);

      const definedFeedbacks = step.options
        .map(option => ({ option, feedback: step.feedbacks[option] }))
        .filter((entry): entry is { option: ActionType; feedback: NonNullable<typeof entry.feedback> } => Boolean(entry.feedback));
      const declaredBestActions = new Set(definedFeedbacks.map(entry => entry.feedback.bestAction));
      if (declaredBestActions.size > 1) {
        errors.push(`${stepPrefix}: feedbacks disagree on canonical bestAction (${[...declaredBestActions].join(', ')})`);
      }
      const canonicalBest = definedFeedbacks[0]?.feedback.bestAction;
      const highestScore = definedFeedbacks.reduce((max, entry) => Math.max(max, entry.feedback.score), -Infinity);
      const highestActions = definedFeedbacks.filter(entry => entry.feedback.score === highestScore).map(entry => entry.option);

      step.options.forEach(option => {
        const feedback = step.feedbacks[option];
        if (!feedback) {
          errors.push(`${stepPrefix}: option "${option}" has no feedback`);
          return;
        }
        if (!step.options.includes(feedback.bestAction)) errors.push(`${stepPrefix}: bestAction "${feedback.bestAction}" is not an option`);
        if (feedback.score < 0 || feedback.score > 10) errors.push(`${stepPrefix}: score must be between 0 and 10`);
        if (feedback.judgment === '正確' && feedback.score < 8) errors.push(`${stepPrefix}: judgment "正確" requires score >= 8 for option "${option}"`);
        if (feedback.judgment === '錯誤' && feedback.score >= 8) errors.push(`${stepPrefix}: judgment "錯誤" requires score < 8 for option "${option}"`);
        if (canonicalBest && feedback.bestAction !== canonicalBest) {
          errors.push(`${stepPrefix}: option "${option}" declares bestAction "${feedback.bestAction}" but canonical bestAction is "${canonicalBest}"`);
        }
      });

      if (canonicalBest && highestActions.length && !highestActions.includes(canonicalBest)) {
        errors.push(`${stepPrefix}: canonical bestAction "${canonicalBest}" is not among highest-scoring actions (${highestActions.join(', ')})`);
      }
      if (canonicalBest) {
        const bestFeedback = step.feedbacks[canonicalBest];
        if (!bestFeedback || bestFeedback.score < 8) errors.push(`${stepPrefix}: canonical bestAction "${canonicalBest}" must score at least 8`);
      }

      Object.keys(step.feedbacks).forEach(option => {
        if (!step.options.includes(option as ActionType)) errors.push(`${stepPrefix}: feedback exists for unknown option "${option}"`);
      });
    });

    scenario.steps.forEach(step => {
      Object.values(step.feedbacks).forEach(feedback => {
        if (feedback && feedback.nextStepId !== 'next_hand' && !stepIds.has(feedback.nextStepId)) {
          errors.push(`${prefix}, step ${step.id}: nextStepId "${feedback.nextStepId}" does not exist`);
        }
      });
    });
  }

  return errors;
}
