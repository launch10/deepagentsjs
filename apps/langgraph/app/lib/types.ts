import { type ThreadStatus } from "@langchain/langgraph-sdk";
import { type Thread } from "@langchain/langgraph-sdk";

export interface ThreadValues extends Record<string, any> {}

export interface ThreadData<ThreadValues extends Record<string, any> = Record<string, any>> {
    thread: Thread<ThreadValues>;
    status: ThreadStatus;
}
export interface MenuItemType {
  threadId: string;
  url: string;
  projectName: string;
  createdAt: Date;
  updatedAt: Date;
  thread: ThreadData;
}