import { type TaskHistoryType } from "@types";

export interface SummarizeTaskHistoryProps {
  taskSummaries: string[];
  batchSize: number;
}

export const summarizeTaskHistoryPrompt = ({ 
  taskSummaries, 
  batchSize 
}: SummarizeTaskHistoryProps): string => {
  const summariesText = taskSummaries.join('\n\n');
  
  return `<role>
            Context Extraction Assistant
          </role>

          <primary_objective>
            Your sole objective in this task is to extract the highest quality/most relevant context from the conversation history below.
          </primary_objective>

          <objective_information>
            You're nearing the total number of input tokens you can accept, so you must extract the highest quality/most relevant pieces of information from your conversation history.
            This context will then overwrite the conversation history presented below. Because of this, ensure the context you extract is only the most important information to your overall goal.
          </objective_information>

          <instructions>
            - Extract ONLY the most critical information from ${batchSize} tasks
            - Focus on WHAT was built/fixed, not HOW
            - Maximum 30 words total
            - Use abbreviated form (e.g., "Fixed Hero CTA, added Features section, implemented responsive nav")
          </instructions>

          <task_summaries>
            ${summariesText}
          </task_summaries>

          Respond with ONLY the compressed summary. No preamble or explanation.`;
};