// Mock for @inertiajs/react in Storybook
// This provides default mock values for usePage and other Inertia hooks
import { createElement } from "react";

export const defaultPageProps = {
  project: { uuid: "mock-project-uuid" },
  thread_id: "mock-thread-id",
  jwt: "mock-jwt-token",
  langgraph_path: "http://localhost:3001",
};

export const usePage = () => ({
  props: defaultPageProps,
  url: "/",
  component: "MockComponent",
  version: "1",
  scrollRegions: [],
  rememberedState: {},
});

export const router = {
  visit: () => {},
  get: () => {},
  post: () => {},
  put: () => {},
  patch: () => {},
  delete: () => {},
  reload: () => {},
  replace: () => {},
  on: () => () => {},
};

export const Link = ({ children, href, className, ...props }: any) => {
  const { createElement } = require("react");
  return createElement("a", { href, className, ...props }, children);
};
export const Head = ({ children }: any) => null;
export const useForm = () => ({
  data: {},
  setData: () => {},
  post: () => {},
  processing: false,
  errors: {},
  reset: () => {},
});
export const useRemember = (initialValue: any) => [initialValue, () => {}];
