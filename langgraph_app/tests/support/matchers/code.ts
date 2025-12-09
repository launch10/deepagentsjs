import { expect } from "vitest";

declare module "vitest" {
  interface Assertion<T = any> {
    toEqualCode(expected: string): T;
    toMatchCode(expected: string): T;
  }
  interface AsymmetricMatchersContaining {
    toEqualCode(expected: string): any;
    toMatchCode(expected: string): any;
  }
}

const normalizeCode = (str: string): string => {
  return str
    .replace(/\s+/g, " ") // Normalize all whitespace to single spaces
    .replace(/\s*([{}()[\],;:])\s*/g, "$1") // Remove spaces around brackets, parens, etc.
    .replace(/;\s*}/g, ";}") // Normalize semicolon before closing brace
    .trim();
};

expect.extend({
  toEqualCode(received: string, expected: string) {
    const normalizedReceived = normalizeCode(received);
    const normalizedExpected = normalizeCode(expected);

    const pass = normalizedReceived === normalizedExpected;

    if (pass) {
      return {
        pass: true,
        message: () => `Code strings match (ignoring whitespace)`,
      };
    }

    return {
      pass: false,
      message: () =>
        `Code strings do not match (ignoring whitespace)\n\n` +
        `Expected (normalized):\n${normalizedExpected}\n\n` +
        `Received (normalized):\n${normalizedReceived}`,
    };
  },

  toMatchCode(received: string, expected: string) {
    const normalizedReceived = normalizeCode(received);
    const normalizedExpected = normalizeCode(expected);

    const pass = normalizedReceived.includes(normalizedExpected);

    if (pass) {
      return {
        pass: true,
        message: () => `Code substring found (ignoring whitespace)`,
      };
    }

    return {
      pass: false,
      message: () =>
        `Code substring not found (ignoring whitespace)\n\n` +
        `Expected substring (normalized):\n${normalizedExpected}\n\n` +
        `Received (normalized):\n${normalizedReceived}`,
    };
  },
});

export function expectCodeMatch(actual: string, expected: string): void {
  expect(actual, "Code strings should match (ignoring whitespace)").toEqualCode(expected);
}
