export function isNumber(value: unknown): value is number {
    return typeof value === 'number';
}

export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

export function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

export function isObject(value: unknown): value is object {
    return typeof value === 'object' && value !== null;
}

export function isArray(value: unknown): value is any[] {
    return Array.isArray(value);
}

export function isDate(value: unknown): value is Date {
    return value instanceof Date;
}

export function isFunction(value: unknown): value is Function {
    return typeof value === 'function';
}

export function isUndefined(value: unknown): value is undefined {
    return typeof value === 'undefined';
}

export function isNull(value: unknown): value is null {
    return value === null;
}

export function isSymbol(value: unknown): value is symbol {
    return typeof value === 'symbol';
}

export function isError(err: unknown): err is Error {
    return err instanceof Error;
}