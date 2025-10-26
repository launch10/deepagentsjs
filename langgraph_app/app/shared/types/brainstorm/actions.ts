export const ActionTypes = ["helpMeAnswer", "skip", "doTheRest", "finished"] as const;
export type ActionType = typeof ActionTypes[number];

export const isAction = (action: unknown): action is ActionType => {
    return (typeof action === 'string' && action in ActionTypes);
}