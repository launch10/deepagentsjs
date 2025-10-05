import pickBy from "lodash/pickBy";
import isNull from "lodash/isNull";
import isUndefined from "lodash/isUndefined";
import pick from "lodash/pick";
import omit from "lodash/omit";

export function compactObject<T>(obj: T): T {
    const cleaned = pickBy(obj, (value: any) => !isNull(value) && !isUndefined(value));
    return cleaned;
}

export { pick, omit, pickBy, isNull, isUndefined }

export function isString(value: any): value is string {
    return typeof value === "string";
}

export function isNumber(value: any): value is number {
    return typeof value === "number";
}