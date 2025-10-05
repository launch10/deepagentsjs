import { mocks } from '@mocks';
import { evalite } from 'evalite';
import { type PlanPageProps, type PlanPageOutputType } from '@services';
import { createClosedQAScorer } from '@tests/support/evals';

evalite('PagePlanService', {
  data: async() => {
    return [{
      input: {
        userRequest: await mocks.input(
          "PlanPageService",
          "dev-mode",
          "websites"
        )
      }
    }]
  },
  task: async (input: PlanPageProps) => {
    // const planWebsiteOutput = await mocks.get(
    //     "PlanWebsiteService",
    //     "dev-mode",
    //     "websites"
    // ) as PlanWebsiteOutputType;
    // const websitePlan = planWebsiteOutput.websitePlan;

    // const pickThemeOutput = await mocks.get(
    //   "PickThemeService",
    //   "dev-mode",
    //   "websites"
    // ) as PickThemeOutputType;
    // const theme: ThemeType = pickThemeOutput.theme;

    // const input = await mocks.input(
    //   "PickThemeService",
    //   "dev-mode",
    //   "websites"
    // ) as { userRequest: BaseMessage }
    // const userRequest = input.userRequest;

    // return new PlanPageService.execute()
    return await mocks.get(
      "PlanPageService",
      "dev-mode",
      "websites"
    )
  },
  scorers: [
    {
      name: "Returns a list of code tasks",
      scorer: async ({output}: {output: PlanPageOutputType}) => {
        return output.codeTasks.length > 1 ? 1 : 0;
      }
    },
    {
      name: "It is a sensible plan",
      scorer: async ({output, input}: {output: PlanPageOutputType, input: string}) => {
        // It should have a list of code tasks
        // They should all be for basically different sections
        // The flow of logic on the page will make sense
        // It will be persuasive
        
        const PlanPageScorer = createClosedQAScorer({
          criteria: {
            listOfCodeTasks: "The output should include a list of code tasks, each of which should be for different sections of the page",
            sensiblePlan: "The output should be a sensible plan for a website page, which clearly follows from the user's original prompt",
            persuasiveCopy: "The output should be persuasive copy for a website page, which clearly follows from the user's original prompt",
          }
        });
        const response: number = await PlanPageScorer({
          input: input.userRequest,
          output: output,
          useCoT: true
        })
        console.log(response)
        return response;
      }
    },
  ]
});