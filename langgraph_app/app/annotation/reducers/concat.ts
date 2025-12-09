export const concatReducer = <T extends any[]>(current: T, update: T): T => {
  if (update.length === 0) return update;

  return current.concat(update) as T;
};
