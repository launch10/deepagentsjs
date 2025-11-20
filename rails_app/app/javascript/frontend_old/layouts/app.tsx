import { useStore } from "@nanostores/react";
import { useEffect, type ReactNode } from "react";
import { themeStore } from "@stores/theme";
import { projectStore } from "@stores/project";
import { pageStore } from "@stores/page";
import { type APIProject } from "@types/project";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const theme = useStore(themeStore);
  const { pageId } = useStore(pageStore);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const projects = (children?.props?.projects || []) as APIProject[];
  useEffect(() => {
    projectStore.add(projects);
  }, [projects]);

  return children;
};
