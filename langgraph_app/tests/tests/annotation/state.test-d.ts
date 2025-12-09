import { describe, test, expectTypeOf } from "vitest";
import type { BrainstormGraphState, WebsiteGraphState, CoreGraphState } from "@state";
import type { BrainstormAnnotation, WebsiteAnnotation } from "@annotation";

describe("Type Safety", () => {
  test("WebsiteGraphState should have all CoreGraphState properties", () => {
    expectTypeOf<WebsiteGraphState>().toExtend<CoreGraphState>();
  });

  test("WebsiteGraphState should match WebsiteAnnotation.State", () => {
    expectTypeOf<WebsiteGraphState>().toEqualTypeOf<typeof WebsiteAnnotation.State>();
  });

  test("BrainstormGraphState should have all CoreGraphState properties", () => {
    expectTypeOf<BrainstormGraphState>().toExtend<CoreGraphState>();
  });

  test("BrainstormGraphState should match BrainstormAnnotation.State", () => {
    expectTypeOf<BrainstormGraphState>().toEqualTypeOf<typeof BrainstormAnnotation.State>();
  });
});
