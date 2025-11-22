import { renderPrompt } from '@prompts';

interface ProjectSummary {
  summary: string;
}

export const projectSummaryPrompt = async ({ summary }: ProjectSummary): Promise<string> => {
  return renderPrompt(`
    <project-summary>
      ${summary}
    </project-summary>
  `)
}
