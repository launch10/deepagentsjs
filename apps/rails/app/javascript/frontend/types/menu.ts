import { type ThreadData } from "./thread";

export interface MenuItemType {
  threadId: string;
  url: string;
  projectName: string;
  createdAt: Date;
  updatedAt: Date;
  thread: ThreadData;
}