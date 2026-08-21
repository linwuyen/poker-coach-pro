import assert from 'node:assert/strict';
import test from 'node:test';
import { findReviewedExplanation, importExplanationRegistry, validateReviewedExplanation } from '../src/teaching/explanationRegistry';

const explanation = {
  schemaVersion: 1 as const,
  id: 'bb-defense-ako', version: '1.0.0', profileId: 'solver:bb-btn', hand: 'AKo', title: '為什麼這個節點偏 Call',
  why: '在這個已驗證節點中，Call 的 EV 高於其他已提供 action EV；文字只解釋已審核的策略因素。',
  boundaryConditions: ['有效籌碼、open size 或 rake 改變時重新查 solver node。'],
  commonMistake: '把單一 action label 誤當成任何 stack 都適用。',
  contrastiveCue: '先找一個只改 stack 且 solver label 翻轉的 sibling node。',
  reference: 'review://bb-defense-ako', authoredBy: 'Coach A', reviewedBy: ['Reviewer B'], reviewedAt: '2026-08-21T00:00:00Z',
  disclaimer: 'Human-reviewed interpretation; not raw solver output.',
};

test('solver teaching explanation requires human review provenance and explicit boundaries', () => {
  assert.equal(validateReviewedExplanation(explanation).reviewedBy[0], 'Reviewer B');
  assert.throws(() => validateReviewedExplanation({ ...explanation, reviewedBy: [] }));
  assert.throws(() => validateReviewedExplanation({ ...explanation, boundaryConditions: [] }));
});

test('explanation registry versions are immutable and latest reviewed target is discoverable', () => {
  const envelope = { schemaVersion: 1 as const, exportedAt: '2026-08-21T00:00:00Z', explanations: [explanation] };
  const first = importExplanationRegistry(envelope);
  assert.equal(first.explanations.length, 1);
  assert.equal(importExplanationRegistry(envelope, first.explanations).explanations.length, 0);
  assert.throws(() => importExplanationRegistry({ ...envelope, explanations: [{ ...explanation, why: 'mutated' }] }, first.explanations));
  assert.equal(findReviewedExplanation(first.explanations, { profileId: 'solver:bb-btn', hand: 'AKo' })?.id, explanation.id);
});
