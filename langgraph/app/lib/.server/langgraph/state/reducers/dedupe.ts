export const dedupeReducer = (tasks: Record<string, unknown>[]): Record<string, unknown>[] => {
    const idSet = new Set();
    const deduped: Record<string, unknown>[] = [];
    tasks.forEach(task => {
        const id = (task.type as string) + '/' + (task.filePath as string);
        if (!idSet.has(id)) {
            idSet.add(id);
            deduped.push(task);
        }
    });
    return deduped;
};