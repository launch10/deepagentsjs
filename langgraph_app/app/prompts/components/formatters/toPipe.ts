import { stripTimestamps } from "./utils";
import { isArray, isObject, isNull, isUndefined, isString, isNumber } from "@types";
import { uniq } from "@utils";

export const toPipe = (data: unknown): string => {
  if (isNull(data) || isUndefined(data)) {
    throw Error("cannot pipe undefined or null");
  }
  if (isString(data)) {
    return data;
  }
  if (isNumber(data)) {
    return String(data);
  }
  if (!(isArray(data) || isObject(data))) {
    throw Error(`don't know how to pipe ${data}`);
  }

  let sortedKeys: string[] = [];
  let rows: string[] = [];

  if (isArray(data)) {
    data.forEach((record: Record<string, any>) => {
      sortedKeys = sortedKeys.concat(uniq(Object.keys(stripTimestamps(record))));
    });
    sortedKeys = uniq(sortedKeys);
    rows = data.map((row) => toPipeObject(row, sortedKeys));
  } else if (isObject(data)) {
    sortedKeys = uniq(Object.keys(stripTimestamps(data)));
    rows = [toPipeObject(rows, sortedKeys)];
  }

  return addHeader(rows, sortedKeys);
};

const toPipeObject = (data: Record<string, any>, sortedKeys: string[]): string => {
  const cleanedData = stripTimestamps(data);

  // Extract values in sorted key order
  const values = sortedKeys.map((key) => {
    const value = cleanedData[key];

    // Handle different value types
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    // Escape pipes and handle quotes if needed
    const stringValue = String(value);
    return stringValue.includes("|") ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
  });

  return values.join("|");
};

const addHeader = (rows: string[], sortedKeys: string[]): string => {
  if (sortedKeys.length === 1) {
    return `<${sortedKeys[0]}>${rows.join("\n")}</${sortedKeys[0]}>`;
  } else {
    return `${sortedKeys.join("|")}\n${rows.join("\n")}`;
  }
};
