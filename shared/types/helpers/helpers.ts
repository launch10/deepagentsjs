export type Equal<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends
    (<T>() => T extends Y ? 1 : 2)
      ? true
      : false;

export type Expect<T extends true> = T;

/**
 * Type diagnostic utilities for better error messages when types don't match.
 *
 * Usage:
 * ```ts
 * // Instead of: type _Assertion = Expect<Equal<A, B>>;
 * // Use: type _Diff = TypeDiff<A, B>;
 * // Hover over _Diff to see which keys differ
 * ```
 */

/** Keys in A but not in B */
export type MissingInB<A, B> = Exclude<keyof A, keyof B>;

/** Keys in B but not in A */
export type ExtraInB<A, B> = Exclude<keyof B, keyof A>;

/** Keys present in both but with different types */
export type TypeMismatchKeys<A, B> = {
  [K in keyof A & keyof B]: Equal<A[K], B[K]> extends true ? never : K;
}[keyof A & keyof B];

/** Full diff between two types - hover to see differences */
export type TypeDiff<A, B> = {
  missingInB: MissingInB<A, B>;
  extraInB: ExtraInB<A, B>;
  typeMismatches: TypeMismatchKeys<A, B>;
  /** If all are never, types match! */
  isEqual: Equal<A, B>;
};

/** Shows mismatched keys with their types side-by-side */
export type ShowMismatches<A, B> = {
  missingFromB: MissingInB<A, B>;
  extraInB: ExtraInB<A, B>;
  typeDifferences: {
    [K in TypeMismatchKeys<A, B>]: {
      inA: K extends keyof A ? A[K] : never;
      inB: K extends keyof B ? B[K] : never;
    };
  };
};
