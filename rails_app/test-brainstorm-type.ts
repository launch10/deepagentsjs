import { type BrainstormLanggraphData } from '@shared';

// What does the type resolve to?
type Test = BrainstormLanggraphData;

// Is it any?
type IsAny = 0 extends (1 & Test) ? 'yes' : 'no';

// Export for inspection
const test: Test = {} as any;
export { test, IsAny };
