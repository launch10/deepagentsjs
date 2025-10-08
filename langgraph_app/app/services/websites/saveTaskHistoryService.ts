import { 
    type NotificationOptions,
    getLlm, 
    LLMSkill, 
    defaultCachePolicy, 
    withInfrastructure,
} from "@core";
import { summarizeTaskHistoryPrompt } from "@prompts";
import { type CodeTaskType, Task, type PageType, Website, type TaskHistoryType, type WebsiteFileType } from "@types";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { configuredModels } from "@core";
import { keyBy, minBy } from "@utils";
import { WebsiteFileModel } from "@models";

export type SaveTaskHistoryProps = {
  website: Website.WebsiteType;
  pages: PageType[];
  completedTasks: CodeTaskType[];
  taskHistory: TaskHistoryType[];
}

export type SaveTaskHistoryOutputType = {
  taskHistory: TaskHistoryType[];
}

const notificationContext: NotificationOptions = {
  taskName: `Remembering task history`,
  taskType: Task.TypeEnum.CodeTask,
};

type AnnotatedTask = {
  task: CodeTaskType;
  tokenCount: number;
}

const SUMMARIZE_BATCH_SIZE = 5;

let _maxTokensBeforeSummaryOverride: number | null = null;

export function setMaxTokensBeforeSummary(value: number | null) {
  _maxTokensBeforeSummaryOverride = value;
}
export class SaveTaskHistoryService {
  @withInfrastructure({
      cache: {
          prefix: "saveTaskHistory",
          ...defaultCachePolicy
      },
      notifications: notificationContext,
  })
  async execute(input: SaveTaskHistoryProps, config?: LangGraphRunnableConfig): Promise<SaveTaskHistoryOutputType> {
    const histories = await this.getHistories(input);
    const estimatedTokenCount = await this.estimateTokenCount(histories);

    if (estimatedTokenCount <= this.maxTokensBeforeSummary()) {
      return { taskHistory: histories }
    } else {
      return await this.summarizeTaskHistories(histories);
    }
  }

  private async summarizeTaskHistories(histories: TaskHistoryType[]) {
    const annotatedTasks: AnnotatedTask[] = this.annotateTasks(histories);
    const targetTokenCount = Math.floor(this.maxTokensBeforeSummary() * 0.8);
    const preserved: TaskHistoryType[] = [];
    let preservedTokenCount = 0;
    
    // Preserve recent messages up to 80% of max tokens
      for (let i = annotatedTasks.length - 1; i >= 0; i--) {
        if (preservedTokenCount + annotatedTasks[i].tokenCount <= targetTokenCount) {
          preserved.unshift(annotatedTasks[i].task);
          preservedTokenCount += annotatedTasks[i].tokenCount;
        } else {
          break;
        }
      }
      
      const toSummarize = histories.slice(0, histories.length - preserved.length);
      
      if (toSummarize.length > 0) {
        const summarized = await this.summarizeBatches(toSummarize, SUMMARIZE_BATCH_SIZE);
        
        return { 
          taskHistory: [...summarized, ...preserved],
        };
      } else {
        // All messages fit within the limit after preservation
        return { taskHistory: preserved };
      }

  }

  private async getHistories(input: SaveTaskHistoryProps): Promise<TaskHistoryType[]> {
    const websiteFileIds = input.completedTasks.map((task) => task.websiteFileId);
    const websiteFiles: WebsiteFileType[] = await WebsiteFileModel.where({ id: websiteFileIds })
    const websiteFileById = keyBy(websiteFiles, "id");

    const newHistories: TaskHistoryType[] = input.completedTasks.map((task) => {
      return {
        websiteId: task.websiteId,
        type: task.type,
        componentId: task.componentId,
        filePath: websiteFileById[task.websiteFileId].path,
        summary: task.results?.summary,
      }
    });
    const histories = [...(input.taskHistory || []), ...newHistories];
    return histories;
  }

  private annotateTasks(histories: TaskHistoryType[]): AnnotatedTask[] {
    return histories.map((task) => ({
      task: task,
      tokenCount: this.estimateStringTokenCount(task.summary || "")
    }));
  }

  private async estimateTokenCount(histories: TaskHistoryType[]) {
    return this.annotateTasks(histories).reduce((sum, task) => sum + task.tokenCount, 0);
  }

  private estimateStringTokenCount(text: string): number {
    const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    
    // Adjust multiplier based on text characteristics
    let multiplier = 1.33; // default
  
    // Code or technical text tends to have more tokens per word
    if (/[{}[\]();,.]/.test(text) || /\b(function|const|let|var|import|export)\b/.test(text)) {
      multiplier = 1.5;
    }
    
    // Very short words or lots of punctuation increase token density
    const avgWordLength = text.replace(/\s+/g, '').length / Math.max(wordCount, 1);
    if (avgWordLength < 4) {
      multiplier *= 1.1;
    }
    
    return Math.ceil(wordCount * multiplier);
  }

  private maxTokensBeforeSummary(): number {
    if (_maxTokensBeforeSummaryOverride !== null) {
      return _maxTokensBeforeSummaryOverride;
    }
    const model = minBy(configuredModels, (model) => model.maxTokens);
    return Math.floor((model?.maxTokens || 4000) * 0.8);
  }

  private async summarizeBatches(histories: TaskHistoryType[], batchSize: number = SUMMARIZE_BATCH_SIZE): Promise<TaskHistoryType[]> {
    const llm = getLlm(LLMSkill.Writing);
    
    // Create batches for parallel processing
    const batches: TaskHistoryType[][] = [];
    for (let i = 0; i < histories.length; i += batchSize) {
      batches.push(histories.slice(i, Math.min(i + batchSize, histories.length)));
    }
    
    // Process all batches in parallel
    const summaryPromises = batches.map(async (batch) => {
      const taskSummaries = batch.map(h => h.summary).filter(Boolean) as string[];
      
      if (taskSummaries.length === 0) return null;
      
      const prompt = summarizeTaskHistoryPrompt({
        taskSummaries,
        batchSize: batch.length,
      });
      
      const response = await llm.invoke(prompt);
      const summary = response.content as string;
      
      return {
        websiteId: batch[0].websiteId,
        type: batch[0].type,
        componentId: batch[0].componentId,
        filePath: batch[0].filePath,
        summary: summary.trim(),
      } as TaskHistoryType;
    });
    
    const results = await Promise.all(summaryPromises);
    
    // Filter out null results from batches with no summaries
    return results.filter((result): result is TaskHistoryType => result !== null);
  }
}