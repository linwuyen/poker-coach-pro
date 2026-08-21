export * from './types';
export * from './engine';
export * from './importer';
export * from './truth';
export * from './exploit';
export * from './population';
export * from './populationRegistry';
export * from './coverage';
export * from './truthPortfolio';

import { STRATEGY_PROFILES_V2 as RFI_PROFILES } from './data';
import { ADVANCED_STRATEGY_PROFILES } from './advancedData';

export const STRATEGY_PROFILES_V2 = [...RFI_PROFILES, ...ADVANCED_STRATEGY_PROFILES];
