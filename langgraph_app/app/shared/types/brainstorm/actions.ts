export const ActionTypes = ["HELP_ME_ANSWER", "SKIP", "DO_THE_REST", "FINISHED"] as const;
export type ActionType = typeof ActionTypes[number];

export const isActionType = (action: unknown): action is ActionType => {
    return (typeof action === 'string' && action in ActionTypes);
}