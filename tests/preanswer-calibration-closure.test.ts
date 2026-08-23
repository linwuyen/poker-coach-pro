import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('timing and reasoning upserts preserve the original pre-answer learning annotation', () => {
  const source = readFileSync('src/features/training/InfiniteTrainingTable.tsx', 'utf8');
  assert.match(source, /attemptLearningAnnotations\s*=\s*useRef\(new Map<string, AttemptLearningAnnotation>\(\)\)/);
  assert.match(source, /const cachedAnnotation = item\.attemptId \? attemptLearningAnnotations\.current\.get\(item\.attemptId\) : undefined/);
  assert.match(source, /predictedSuccessProbability:\s*item\.predictedSuccessProbability\s*\?\?\s*cachedAnnotation\?\.predictedSuccessProbability\s*\?\?\s*priorPersisted\?\.predictedSuccessProbability\s*\?\?\s*signal\?\.predictedSuccessProbability/);
  assert.match(source, /learningPriorityScore:\s*item\.learningPriorityScore\s*\?\?\s*cachedAnnotation\?\.learningPriorityScore\s*\?\?\s*priorPersisted\?\.learningPriorityScore\s*\?\?\s*signal\?\.priorityScore/);
  assert.match(source, /attemptLearningAnnotations\.current\.set\(item\.attemptId, stableAnnotation\)/);
  assert.match(source, /Never recompute prediction from history after the observed outcome is already known/);
});
