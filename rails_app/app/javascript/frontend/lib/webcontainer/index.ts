import { WebContainer } from "@webcontainer/api";

export const WORK_DIR_NAME = "project";
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;

interface WebContainerContext {
  loaded: boolean;
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data
  .webcontainerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

/**
 * Singleton promise for the WebContainer instance.
 * Supports hot module reloading by preserving the instance across reloads.
 */
export let webcontainer: Promise<WebContainer> = new Promise(() => {
  // noop for ssr
});

if (!import.meta.env.SSR) {
  webcontainer =
    import.meta.hot?.data.webcontainer ??
    Promise.resolve()
      .then(() => {
        return WebContainer.boot({ workdirName: WORK_DIR_NAME });
      })
      .then((wc) => {
        webcontainerContext.loaded = true;
        return wc;
      });

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = webcontainer;
  }
}

export * from "./types";
export * from "./file-utils";
