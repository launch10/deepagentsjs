import { type Website } from "@types";
import { renderPrompt, toJSON } from '@prompts';
import { pick } from '@utils';

interface ComponentPlanProps {
    contentPlan: Website.Component.ComponentContentPlanType;
    overview: Website.Component.OverviewType;
}

export const componentPlanPrompt = async ({ overview, contentPlan }: ComponentPlanProps): Promise<string> => {
    if (!overview){
        throw new Error("Overview is required for component content plan generation")
    }
    if (!contentPlan){
        throw new Error("Content plan is required for component content plan generation")
    }
    if (Object.keys(contentPlan).length === 0){
        throw new Error("Content plan is required for component content plan generation")
    }
    if (Object.keys(overview).length === 0){
        throw new Error("Overview is required for component content plan generation")
    }
    const plan = contentPlan.data;
    const selectedOverview = pick(overview, [ "backgroundColor", "name", "purpose", "context", "copy", ])
    const output = {
        content: plan,
        overview: selectedOverview
    }

    return renderPrompt(`
        <content-plan>
            ${toJSON(output)}
        </content-plan>
    `)
}