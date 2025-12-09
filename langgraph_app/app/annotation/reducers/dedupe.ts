export const dedupeReducer = (
  tasks: Record<string, unknown>[],
  keyFunc: (task: Record<string, unknown>) => string
): Record<string, unknown>[] => {
  const idSet = new Set();
  const deduped: Record<string, unknown>[] = [];
  tasks.forEach((task) => {
    const key = keyFunc(task);

    if (!idSet.has(key)) {
      idSet.add(key);
      deduped.push(task);
    }
  });
  return deduped;
};
