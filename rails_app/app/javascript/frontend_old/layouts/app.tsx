import { useStore } from '@nanostores/react';
import { useEffect, type ReactNode } from 'react';
import { themeStore } from '@stores/theme';
import { projectStore } from '@stores/project';
import { pageStore } from '@stores/page';
import { type ApiProject } from '@types/project';

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const theme = useStore(themeStore);
  const { pageId } = useStore(pageStore);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const projects = (children?.props?.projects || []) as ApiProject[];
  useEffect(() => {
    projectStore.add(projects);
  }, [projects]);

  return children;
};
