import { evalite } from 'evalite';
import { PlanComponentService, type PlanComponentOutputType, type PlanComponentProps } from '@services';
import { HumanMessage } from '@langchain/core/messages';
import { mockCodeTask, mocks } from "@mocks";

evalite('PlanComponentService', {
  data: async() => {
    return [{
      input: await mocks.input(
        "PlanComponentService",
        "hero",
        "websites",
      )
    }]
  },
  task: async (input) => {
    // return new PlanComponentService().execute(input);
    return await mocks.get(
      "PlanComponentService",
      "hero",
      "websites"
    )
  },
  scorers: [
    {
      name: "Assigns theme to component",
      scorer: async ({output, input}: {output: PlanComponentOutputType, input: PlanComponentProps}) => {
        const theme = output.task.component?.theme;
        return theme ? 1 : 0;
      }
    },
    {
      name: "Builds content plan for component",
      scorer: async ({output, input}: {output: PlanComponentOutputType, input: PlanComponentProps}) => {
        const componentPlan = output.task.component!.componentPlan!.content!;
        return componentPlan.ctaText.length > 1 && 
          componentPlan.headline.length > 1 &&
          componentPlan.layoutVariant.length > 1 &&
          componentPlan.paragraphs.length > 1 &&
          componentPlan.suggestedComponents.length > 1 &&
          componentPlan.trustSignals.length > 1 &&
          componentPlan.visualConcept.length > 1 &&
          componentPlan.visualEmphasis.length > 1 ? 1 : 0
      }
    },
  ]
});