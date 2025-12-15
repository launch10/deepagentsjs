import pickBy from "lodash/pickBy";
import pick from "lodash/pick";
import omit from "lodash/omit";
import identity from "lodash/identity";

export function compactObject<T extends Record<string, any>>(obj: T) {
  return pickBy(obj, identity);
}

export { pick, omit, pickBy };
