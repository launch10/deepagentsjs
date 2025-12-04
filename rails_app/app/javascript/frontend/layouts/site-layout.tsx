import Header from "@components/header/header";

export const SiteLayout = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode => {
  return (
    <div className="bg-background min-h-screen">
      <Header />
      {children}
    </div>
  );
};
