import { z } from "zod"
import { evalite } from 'evalite';
import { 
  PlanWebsiteService, 
  type PlanWebsiteProps,
  type PlanWebsiteOutputType,
} from '@services';
import { HumanMessage } from '@langchain/core/messages';
import { mocks } from "@mocks";
import { Website } from "@types";
import { PersuasivenessScorer } from '@tests/support/evals';

function validJSON(output: any, schema: z.ZodSchema): number {
  return schema.safeParse(output).success ? 1 : 0;
}

evalite('PlanWebsiteService', {
  data: async() => {
    return [{
      input: {
        userRequest: new HumanMessage("Make a website that sells wigs for dogs called Dog Wigz"),
      }
    }]
  },
  task: async (input: PlanWebsiteProps) => {
    // return new PlanWebsiteService().execute(input);
    return await mocks.get(
        "PlanWebsiteService",
        "dev-mode",
        "websites"
    ) as PlanWebsiteOutputType;
  },
  scorers: [
    {
      name: "Returns a valid theme plan",
      scorer: async ({output}: {output: PlanWebsiteOutputType}) => {
        return validJSON(output.contentStrategy, Website.Plan.contentStrategySchema);
      }
    },
    {
      name: "Write persuasive landing page copy",
      scorer: async ({output, input}: {output: PlanWebsiteOutputType, input: HumanMessage}) => {
        const score = await PersuasivenessScorer({
          input: input.userRequest.content,
          output: output.contentStrategy.landingPageCopy,
          useCoT: true
        })
        return score;
      }
    },
  ]
});