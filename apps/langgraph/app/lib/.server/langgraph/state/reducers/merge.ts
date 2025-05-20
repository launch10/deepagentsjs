export const mergeReducer = <T extends Record<any,any>>(current: T, update: Partial<T>): T => ({
    ...current,
    ...update
});