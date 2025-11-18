import { z } from "zod"
import { evalite } from 'evalite';
import { 
  PlanWebsiteService, 
  type PlanWebsiteProps,
  type PlanWebsiteOutputType,
} from '@services';
import { HumanMessage } from '@langchain/core/messages';
import { Website } from "@types";
import { PersuasivenessScorer } from '@tests/support/evals';

function validJSON(output: any, schema: z.ZodSchema): number {
  return schema.safeParse(output).success ? 1 : 0;
}

evalite('CreateComponentService', {
  data: async() => {
    const input = await mocks.input(
      "PlanPageService",
      "dev-mode",
      "websites"
    )
    return [{
      input: input
    }]
  },
  task: async (input: PlanWebsiteProps) => {
  },
  scorers: [
    {
      name: "Returns a valid theme plan",
      scorer: async ({output}: {output: PlanWebsiteOutputType}) => {
        return validJSON(output.websitePlan, Website.Plan.planSchema);
      }
    },
    {
      name: "Write persuasive landing page copy",
      scorer: async ({output, input}: {output: PlanWebsiteOutputType, input: HumanMessage}) => {
        const score = await PersuasivenessScorer({
          input: input.userRequest.content,
          output: output.websitePlan.contentStrategy.synthesizedLandingPageCopy,
        })
        return score;
      }
    },
  ]
});