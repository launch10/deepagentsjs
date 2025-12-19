/**
 * Asset field types that can appear in API error responses.
 */
export const ASSET_FIELDS = [
  "headlines",
  "descriptions",
  "callouts",
  "keywords",
  "details",
  "features",
] as const;

export type AssetFieldName = (typeof ASSET_FIELDS)[number];

export type ParsedFieldName = {
  /** Field path in react-hook-form dot notation (e.g., "headlines.5.text") */
  fieldNameAndIndex: string;
  /** Human-readable field name (e.g., "Headline 6") */
  prettyFieldName: string;
};

/**
 * Extracts the asset field portion from a nested API path.
 * @example
 * extractAssetField("ad_groups[0].ads[0].headlines[5].text") // "headlines[5].text"
 */
function extractAssetField(fieldName: string): string {
  for (const assetField of ASSET_FIELDS) {
    const regex = new RegExp(`${assetField}\\[\\d+\\].*$`);
    const match = fieldName.match(regex);
    if (match) return match[0];
  }
  return fieldName;
}

/**
 * Converts bracket notation to dot notation for react-hook-form compatibility.
 * @example
 * bracketsToDots("headlines[5]") // "headlines.5"
 * bracketsToDots("headlines[5].text") // "headlines.5.text"
 */
function bracketsToDots(str: string): string {
  return str.replace(/\[(\d+)\]/g, ".$1");
}

/**
 * Singularizes a field name by removing trailing 's'.
 * @example
 * singularize("headlines") // "headline"
 * singularize("callouts") // "callout"
 */
function singularize(name: string): string {
  return name.endsWith("s") ? name.slice(0, -1) : name;
}

/**
 * Capitalizes the first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Creates a human-readable field name from a bracket-notation field.
 * @example
 * humanizeFieldName("headlines[5]") // "Headline 6"
 * humanizeFieldName("descriptions[0].text") // "Description 1"
 */
function humanizeFieldName(fieldName: string): string {
  const match = fieldName.match(/^(\w+)\[(\d+)\]/);
  if (!match) {
    return capitalize(fieldName);
  }

  const [, baseName, index] = match;
  const singular = singularize(baseName);
  // +1 because API uses 0-indexed but humans expect 1-indexed
  return `${capitalize(singular)} ${parseInt(index) + 1}`;
}

/**
 * Parses an API field name into react-hook-form compatible format.
 * Handles nested API paths like "ad_groups[0].ads[0].headlines[5].text"
 * and extracts the relevant asset field portion.
 *
 * @example
 * parseFieldNameFromApi("ad_groups[0].ads[0].headlines[5].text")
 * // { fieldNameAndIndex: "headlines.5.text", prettyFieldName: "Headline 6" }
 *
 * parseFieldNameFromApi("descriptions[0].text")
 * // { fieldNameAndIndex: "descriptions.0.text", prettyFieldName: "Description 1" }
 */
export function parseFieldNameFromApi(fieldName: string): ParsedFieldName {
  const relevantPart = extractAssetField(fieldName);
  return {
    fieldNameAndIndex: bracketsToDots(relevantPart),
    prettyFieldName: humanizeFieldName(relevantPart),
  };
}

/**
 * Checks if a field name represents an asset field.
 */
export function isAssetField(fieldName: string): boolean {
  return ASSET_FIELDS.some((field) => fieldName.startsWith(field));
}
