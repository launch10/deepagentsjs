import { map } from 'nanostores';

// Define an interface for the page store's state
export interface PageState {
  jwt: string | null;
  rootPath: string | null;
  threadId: string | null;
}

// Create an atom that holds an object of this interface type
export const pageStore = map<PageState>({
  jwt: null,
  rootPath: null,
  threadId: null,
});