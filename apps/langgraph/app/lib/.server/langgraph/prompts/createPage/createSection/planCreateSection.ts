import { type Section, type SectionOverview } from '@models/section';
import { formatBrandInfo, formatSectionOverview, formatCopy, formatArray } from '@prompts/helpers/formatters';
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { Template } from '@langgraph/models/template';
import { PromptTemplate } from "@langchain/core/prompts";
import type { GraphState } from "@shared/state/graph";
import { type ProjectData } from '@models/project';
import { type FileSpecification } from "@models/fileSpecification";
import { type CodeTask } from "@models/codeTask";
import { sectionLayoutSchema } from "@models/section";

const basePrompt = PromptTemplate.fromTemplate(`
      <role>
        You are a Section Planner Agent. Your task is to take a high-level overview of a single section of a landing page and expand it into a comprehensive, detailed plan.
        This detailed plan will be used by another AI (The Code Generator) to implement the section's code.
        Focus on providing clear, actionable details covering content, layout, visuals, and interactivity based on the section's goal and overall brand guidelines.
        The end goal is to create an incredible, high-converting landing page, so ensure that the plan is both effective and engaging, and easy for the code writer agent to implement.
      </role>

      <landing-page-summary>
        {projectSummary}
      </landing-page-summary>

      <brand-guidelines>
        {brandGuidelines}
      </brand-guidelines>

      <section-overview>
        {sectionOverview}
      </section-overview>

      <copy>
        {copy}
      </copy>

      <instructions>
        1.  **Analyze Input:** Carefully review the provided <section_overview> and <brand_guidelines>.
        2.  **Analyze Existing Content:** You may find suggested content for your section. Use this to inform your content strategy.
        3.  **Write Missing Content:** If the section needs content, write it. (E.g. if the section requires a headline, but does not have one, write the headline.)
        4.  **Layout Design:** Describe a suitable visual structure (<layoutDescription>) that fits the section type and content. Specify column counts, element arrangement (image left/right, centered text, etc.), and key element placement. Indicate the visual focus (<layoutEmphasis>).
        5.  **Visual Styling:** Suggest aesthetic choices (<visualStyleNotes>) aligning with the <brand_guidelines>. Mention color usage, spacing, typography hints, and potential image/icon styles.
        6.  **Responsiveness:** Briefly note how the layout should adapt on mobile (<responsivenessNotes>).
        7.  **Suggest Available Components:** Suggest available Shadcn UI components from the <available-components> list that you could be used to implement the section.
        8.  **Output:** Generate a detailed section plan that adheres to the required detailed section schema. Follow the specific instructions provided for the given section type.
      </instructions>

      <available-components component-source="shadcn ui">
        {availableComponents}
      </available-components>

      <section-specific-instructions>
        {sectionPrompt}
      </section-specific-instructions>

      <important>
        For visual elements, ONLY use Lucide icons from lucide-react that you know exist, OR stock photos from unsplash whose valid URLs you know exist. Do not download the images, only link to them in image tags.
        DO NOT suggest images or animations that do not exist. We do not have the resources to create them.
      </important>

      <user-request>
        {userRequest}
      </user-request>

      <task>
        Generate the detailed plan for the section based on the provided information.
        Follow the specific instructions provided for the given section type.
      </task>

      <important>
        // - The 'subtype' field MUST equal {sectionType}
      </important>
      <output>
        {formatInstructions}
      </output>
`)

export const planCreateSectionPrompt = async (state: GraphState): Promise<string> => {
    const task = state.task as CodeTask;
    const spec = task.fileSpec as FileSpecification;
    if (!spec.schema) {
      throw new Error(`Schema not found for section type: ${spec.subtype} in fileSpec for task ${task.id}`);
    }
    const schema = sectionLayoutSchema.merge(spec.schema);
    const parser = StructuredOutputParser.fromZodSchema(schema);
    const formatInstructions = parser.getFormatInstructions();

    const template = await Template.getTemplate("default");
    const availableComponents = await template.availableComponents();

    const project = state.app.project as ProjectData;
    const projectPlan = project.projectPlan;
    const section = state.task.section as Section;
    const sectionOverview = section.contentPlan?.overview as SectionOverview;
    const sectionPrompt = spec.generationPrompt ? await spec.generationPrompt(state) : '';
    const userRequest = state.userRequest.content as string;

    return basePrompt.format({
        projectSummary: projectPlan.summary,
        brandGuidelines: formatBrandInfo(state),
        sectionOverview: formatSectionOverview(sectionOverview),
        copy: formatCopy(sectionOverview.copy),
        availableComponents: formatArray('available-component', availableComponents),
        sectionPrompt,
        userRequest,
        formatInstructions,
        sectionType: sectionOverview.sectionType
    })
}