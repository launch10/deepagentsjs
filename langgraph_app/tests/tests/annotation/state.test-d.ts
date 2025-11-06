import { describe, test, expectTypeOf } from 'vitest';
import type { BrainstormGraphState, WebsiteGraphState, CoreGraphState } from '@state';

describe('Type Safety', () => {
  test('WebsiteGraphState should have all CoreGraphState properties', () => {
    expectTypeOf<WebsiteGraphState>().toExtend<CoreGraphState>();
  });

  test('BrainstormGraphState should have all CoreGraphState properties', () => {
    expectTypeOf<BrainstormGraphState>().toExtend<CoreGraphState>();
  });
});