import pickBy from "lodash/pickBy";
import isNull from "lodash/isNull";
import isUndefined from "lodash/isUndefined";
import pick from "lodash/pick";
import omit from "lodash/omit";
import identity from "lodash/identity";

export function compactObject<T extends Record<string, any>>(obj: T) {
    return pickBy(obj, identity);
}

export { pick, omit, pickBy, isNull, isUndefined }

export function isString(value: any): value is string {
    return typeof value === "string";
}

export function isNumber(value: any): value is number {
    return typeof value === "number";
}