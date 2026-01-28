import Header from "@components/shared/header/Header";

export const AuthLayout = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF9]">
      <Header />

      {/* Centered content */}
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        {children}
      </main>
    </div>
  );
};
