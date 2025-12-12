import Header from "@components/header/header";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export const SiteLayout = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="bg-background min-h-screen">
        <Header />
        {children}
      </div>
    </QueryClientProvider>
  );
};
