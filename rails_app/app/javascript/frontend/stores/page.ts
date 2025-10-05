import { map } from 'nanostores';

// Define an interface for the page store's state
export interface PageState {
  jwt: string | null;
  accountId: number | null;
  rootPath: string | null;
  threadId: string | null;
  pageId: string | null;
  isNewThread: boolean;
}

// Create an atom that holds an object of this interface type
export const pageStore = map<PageState>({
  jwt: null,
  accountId: null,
  rootPath: null,
  threadId: null,
  pageId: null,
  isNewThread: false,
});