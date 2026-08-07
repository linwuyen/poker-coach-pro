import { RANGE_QUESTIONS } from '../src/features/range/data';
import { validateRangeQuestions } from '../src/features/range/rangeEngine';

const errors = validateRangeQuestions(RANGE_QUESTIONS);
if (errors.length) {
  console.error(`Range question validation failed with ${errors.length} error(s):`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Validated ${RANGE_QUESTIONS.length} range-versus-hand questions successfully.`);
