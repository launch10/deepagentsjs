import { stringify } from "./fast-safe-stringify";
import { createHash, type BinaryToTextEncoding } from "crypto";

export const shasum = (
  input: any,
  hash: string = "sha256",
  digest: BinaryToTextEncoding = "hex"
) => {
  return createHash(hash).update(stringify(input)).digest(digest);
};
