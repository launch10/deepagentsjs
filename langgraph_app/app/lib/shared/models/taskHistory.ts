import { CodeTaskType } from "./codeTask";
import { type CodeTaskSummary } from "./codeTask"; 

export type TaskHistoryType = {
  byFile: {
    [filePath: string]: {
      [taskType in CodeTaskType]: CodeTaskSummary[]
    }
  },
  edits: CodeTaskSummary[]
};

export class TaskHistory implements TaskHistoryType {
    byFile: {
        [filePath: string]: {
            [taskType in CodeTaskType]?: CodeTaskSummary[] // Optional property for task types
        }
    };
    edits: CodeTaskSummary[];

    constructor() {
        this.byFile = {};
        this.edits = [];
    }

    /**
     * Adds a task summary to the history, updating both the chronological 'edits' list
     * and the 'byFile' lookup object.
     * @param summary - The CodeTaskSummary object to add.
     */
    addSummary(summary: CodeTaskSummary): void {
        // Add to chronological list
        this.edits.push(summary);

        // Add to byFile lookup
        const { filePath, type } = summary;
        if (!this.byFile[filePath]) {
            this.byFile[filePath] = {}; // Initialize file entry if it doesn't exist
        }
        if (!this.byFile[filePath][type]) {
            this.byFile[filePath][type] = []; // Initialize task type array if it doesn't exist
        }
        // We know the array exists now, so we can push safely.
        this.byFile[filePath][type]!.push(summary); // Use non-null assertion '!' as we ensured initialization
    }

    /**
     * Formats the chronological history of edits into a string.
     * @returns A string representation of the task history.
     */
    formatHistory(): string {
        if (this.edits.length === 0) return "No past history recorded.";
        return this.edits.map(task => `
            <task>
            <type>${task.type}</type>
            <file>${task.filePath}</file>
            <instructions>${task.instruction}</instructions>
            ${task.summary ? `<summary>${task.summary}</summary>` : ''}
            </task>`).join("\n");
    }
}