import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import { BoltIcon, LinkIcon } from "@heroicons/react/16/solid";
import SetupCustomDomain from "./SetupCustomDomain";
import SetupSubDomain from "./SetupSubDomain";

export default function DomainSetup() {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-neutral-300 bg-white px-10 py-7">
      {/* Header */}
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold leading-[22px] text-base-500">Domain Setup</h2>
        <p className="text-xs leading-4 text-base-300">
          Choose how you want your website to be accessed
        </p>
      </div>

      {/* Tab Switcher */}
      <Tabs defaultValue="subdomain">
        <TabsList className="w-1/2 rounded-full">
          <TabsTrigger value="subdomain" className="data-[state=active]:bg-white rounded-full">
            <BoltIcon className="size-4" />
            <span className="text-sm">Subdomain</span>
          </TabsTrigger>
          <TabsTrigger value="custom" className="data-[state=active]:bg-white rounded-full">
            <LinkIcon className="size-4" />
            <span className="text-sm">Custom Domain</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="subdomain">
          <SetupSubDomain />
        </TabsContent>
        <TabsContent value="custom">
          <SetupCustomDomain />
        </TabsContent>
      </Tabs>
    </div>
  );
}
