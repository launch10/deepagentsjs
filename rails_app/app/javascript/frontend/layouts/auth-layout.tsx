import Header from "@components/shared/header/Header";

export const AuthLayout = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      {/* Centered content - pb-24 shifts visual center upward */}
      <main className="flex flex-1 items-center justify-center px-4 py-8 pb-12">{children}</main>
    </div>
  );
};
