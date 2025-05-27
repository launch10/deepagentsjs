import { useStore } from '@nanostores/react';
import { useEffect, type ReactNode } from 'react';
import { LanggraphProvider } from '@context/LanggraphContext';
import { themeStore } from '@stores/theme';
import { projectStore } from '@stores/project';
import { useThreadId } from '@hooks/useThreadId';

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const theme = useStore(themeStore);
  const { threadId } = useThreadId();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const projects = children?.props?.projects || [];
  useEffect(() => {
    projectStore.addProjects(projects);
  }, [projects]);

  return (
    <LanggraphProvider threadId={threadId}>
      {children}
    </LanggraphProvider>
  );
};
