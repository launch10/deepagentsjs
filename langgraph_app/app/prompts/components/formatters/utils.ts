export const stripTimestamps = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(stripTimestamps);
  }

  if (typeof obj === "object") {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip timestamp fields in both camelCase and kebab-case
      if (
        key === "createdAt" ||
        key === "updatedAt" ||
        key === "created-at" ||
        key === "updated-at"
      ) {
        continue;
      }
      cleaned[key] = stripTimestamps(value);
    }
    return cleaned;
  }

  return obj;
};
