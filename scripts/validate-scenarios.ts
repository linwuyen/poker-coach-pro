import { scenarios } from '../src/data';
import { validateScenarios } from '../src/utils/validateScenarios';

const errors = validateScenarios(scenarios);
if (errors.length) {
  console.error(`Scenario validation failed with ${errors.length} error(s):`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

const multiStreet = scenarios.filter(scenario => scenario.steps.length > 1).length;
console.log(`Validated ${scenarios.length} scenarios (${multiStreet} multi-street) successfully.`);
