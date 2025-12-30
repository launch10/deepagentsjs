import WebsiteLoader from "@components/website/WebsiteLoader";
import WebsiteSidebar from "@components/website/sidebar/WebsiteSidebar";
import PageOverview from "@components/website/page-overview/PageOverview";
import { useEffect, useState } from "react";

const websiteLoaderSteps = [{ id: "1", label: "Setting up branding & colors" }];

export default function Website() {
  const [isLoading, setIsLoading] = useState(true);

  // TODO: Remove once we have a loading state
  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  }, []);

  return (
    <main className="mx-auto container max-w-7xl grid grid-cols-[288px_1fr] gap-8 px-8 py-2">
      <div>
        <WebsiteSidebar isLoading={isLoading} currentStep={0} />
      </div>
      <div className="max-w-[948px]">
        {isLoading ? (
          <div className="border-[#D3D2D0] border rounded-2xl bg-white flex items-center justify-center min-h-screen">
            <WebsiteLoader steps={websiteLoaderSteps} currentStep={0} />
          </div>
        ) : (
          <div className="border-[#D3D2D0] border rounded-2xl bg-white flex flex-col px-10 py-7">
            <PageOverview />
          </div>
        )}
      </div>
    </main>
  );
}
