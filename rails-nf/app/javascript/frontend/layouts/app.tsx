import { useStore } from '@nanostores/react';
import { useEffect, type ReactNode } from 'react';
import { LanggraphProvider } from '@context/LanggraphContext';
import { themeStore } from '@stores/theme';

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <LanggraphProvider>
      {children}
    </LanggraphProvider>
  );
};
