import { describe, it, expect } from "vitest";
import { Ads, type UUIDType } from "@types";

describe("MergeReducer", () => {
  describe("text-based deduplication of locked assets", () => {
    it("removes incoming assets that have the same text as locked assets", () => {
      const current: Ads.Asset[] = [
        { id: "locked-1" as UUIDType, text: "End Scheduling Chaos", locked: true, rejected: false },
        {
          id: "locked-2" as UUIDType,
          text: "Meeting Times, Solved",
          locked: true,
          rejected: false,
        },
      ];

      // Incoming assets include text-identical copies of locked items (with fresh UUIDs)
      const incoming: Ads.Asset[] = [
        { id: "new-1" as UUIDType, text: "End Scheduling Chaos", locked: false, rejected: false },
        { id: "new-2" as UUIDType, text: "Meeting Times, Solved", locked: false, rejected: false },
        { id: "new-3" as UUIDType, text: "Brand New Headline", locked: false, rejected: false },
        { id: "new-4" as UUIDType, text: "Another Fresh One", locked: false, rejected: false },
      ];

      const result = Ads.MergeReducer.headlines(incoming, current);

      // Should keep the 2 locked assets and only the 2 genuinely new ones
      expect(result.length).toEqual(4);

      const texts = result.map((a) => a.text);
      // Locked originals are kept (not duplicated)
      expect(texts.filter((t) => t === "End Scheduling Chaos").length).toEqual(1);
      expect(texts.filter((t) => t === "Meeting Times, Solved").length).toEqual(1);

      // The locked versions should keep their original IDs
      const lockedResult = result.filter((a) => a.locked);
      expect(lockedResult.length).toEqual(2);
      expect(lockedResult.find((a) => a.text === "End Scheduling Chaos")!.id).toEqual("locked-1");
      expect(lockedResult.find((a) => a.text === "Meeting Times, Solved")!.id).toEqual("locked-2");
    });

    it("keeps incoming assets whose text does not match any locked asset", () => {
      const current: Ads.Asset[] = [
        { id: "locked-1" as UUIDType, text: "Locked One", locked: true, rejected: false },
      ];

      const incoming: Ads.Asset[] = [
        { id: "new-1" as UUIDType, text: "Completely New", locked: false, rejected: false },
        { id: "new-2" as UUIDType, text: "Also New", locked: false, rejected: false },
      ];

      const result = Ads.MergeReducer.headlines(incoming, current);

      expect(result.length).toEqual(3);
      expect(result.map((a) => a.text)).toContain("Locked One");
      expect(result.map((a) => a.text)).toContain("Completely New");
      expect(result.map((a) => a.text)).toContain("Also New");
    });
  });
});
