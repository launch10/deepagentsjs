import { type BrainstormGraphState } from "@state";
import { BrainstormNextStepsService } from "@services";

export const beforeHook = async (state: BrainstormGraphState) => {
  const updatedState = await new BrainstormNextStepsService(state).nextSteps();
  return {
    ...state,
    ...updatedState,
  };
};
