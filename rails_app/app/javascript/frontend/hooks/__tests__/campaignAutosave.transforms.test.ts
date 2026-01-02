import { describe, it, expect } from "vitest";
import {
  defaultAssetTransform,
  buildUpdateRequest,
  type FieldMapping,
} from "@components/ads/hooks/autosave.transforms";

describe("campaignAutosave.transforms", () => {
  describe("defaultAssetTransform", () => {
    it("filters out assets with empty text", () => {
      const assets = [
        { id: "1", text: "Valid headline" },
        { id: "2", text: "" },
        { id: "3", text: "   " },
        { id: "4", text: "Another valid" },
      ];

      const result = defaultAssetTransform(assets);

      expect(result).toEqual([
        { text: "Valid headline" },
        { text: "Another valid" },
      ]);
    });

    it("returns empty array for undefined input", () => {
      expect(defaultAssetTransform(undefined)).toEqual([]);
    });

    it("returns empty array for empty array input", () => {
      expect(defaultAssetTransform([])).toEqual([]);
    });

    it("strips extra properties, keeping only id and text", () => {
      const assets = [{ id: "1", text: "Headline", locked: true, rejected: false }] as any;

      const result = defaultAssetTransform(assets);

      expect(result).toEqual([{ text: "Headline" }]);
      expect(result[0]).not.toHaveProperty("locked");
      expect(result[0]).not.toHaveProperty("rejected");
    });

    it("handles assets with whitespace-only text as empty", () => {
      const assets = [
        { id: "1", text: "  \t\n  " },
        { id: "2", text: "Valid" },
      ];

      const result = defaultAssetTransform(assets);

      expect(result).toEqual([{ text: "Valid" }]);
    });
  });

  describe("buildUpdateRequest", () => {
    type TestFormData = {
      headlines: { id: string; text: string }[];
      descriptions: { id: string; text: string }[];
    };

    it("builds request with single field mapping", () => {
      const fieldMappings: FieldMapping<TestFormData>[] = [
        { formField: "headlines", apiField: "headlines" },
      ];
      const values = [[{ id: "1", text: "Test headline" }]];

      const result = buildUpdateRequest(fieldMappings, values);

      expect(result).toEqual({
        campaign: {
          headlines: [{ text: "Test headline" }],
        },
      });
    });

    it("builds request with multiple field mappings", () => {
      const fieldMappings: FieldMapping<TestFormData>[] = [
        { formField: "headlines", apiField: "headlines" },
        { formField: "descriptions", apiField: "descriptions" },
      ];
      const values = [[{ id: "1", text: "Headline 1" }], [{ id: "2", text: "Description 1" }]];

      const result = buildUpdateRequest(fieldMappings, values);

      expect(result).toEqual({
        campaign: {
          headlines: [{ text: "Headline 1" }],
          descriptions: [{ text: "Description 1" }],
        },
      });
    });

    it("returns null when all values are empty", () => {
      const fieldMappings: FieldMapping<TestFormData>[] = [
        { formField: "headlines", apiField: "headlines" },
      ];
      const values = [[]];

      const result = buildUpdateRequest(fieldMappings, values);

      expect(result).toBeNull();
    });

    it("returns null when all assets have empty text", () => {
      const fieldMappings: FieldMapping<TestFormData>[] = [
        { formField: "headlines", apiField: "headlines" },
      ];
      const values = [
        [
          { id: "1", text: "" },
          { id: "2", text: "   " },
        ],
      ];

      const result = buildUpdateRequest(fieldMappings, values);

      expect(result).toBeNull();
    });

    it("uses custom transform when provided", () => {
      type KeywordFormData = {
        keywords: { id: string; text: string }[];
      };

      const customTransform = (keywords: { id: string; text: string }[] | undefined) =>
        keywords
          ?.filter((k) => k.text?.trim())
          .map(({ id, text }) => ({ id, text, match_type: "broad" })) ?? [];

      const fieldMappings: FieldMapping<KeywordFormData>[] = [
        {
          formField: "keywords",
          apiField: "keywords",
          transform: customTransform as any,
        },
      ];
      const values = [[{ id: "1", text: "keyword one" }]];

      const result = buildUpdateRequest(fieldMappings, values);

      expect(result).toEqual({
        campaign: {
          keywords: [{ id: "1", text: "keyword one", match_type: "broad" }],
        },
      });
    });

    it("handles undefined values gracefully", () => {
      const fieldMappings: FieldMapping<TestFormData>[] = [
        { formField: "headlines", apiField: "headlines" },
      ];
      const values = [undefined];

      const result = buildUpdateRequest(fieldMappings, values);

      expect(result).toBeNull();
    });

    it("includes empty arrays for fields when at least one field has data", () => {
      const fieldMappings: FieldMapping<TestFormData>[] = [
        { formField: "headlines", apiField: "headlines" },
        { formField: "descriptions", apiField: "descriptions" },
      ];
      const values = [[{ id: "1", text: "Valid headline" }], []];

      const result = buildUpdateRequest(fieldMappings, values);

      expect(result).toEqual({
        campaign: {
          headlines: [{ text: "Valid headline" }],
          descriptions: [],
        },
      });
    });
  });
});
