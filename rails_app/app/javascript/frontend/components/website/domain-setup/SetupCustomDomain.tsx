import AwsLogo from "@assets/aws-logo.png";
import CloudflareLogo from "@assets/cloudflare-logo.png";
import GoDaddyLogo from "@assets/godaddy-logo.png";
import NamecheapLogo from "@assets/namecheap-logo.svg";
import { Input } from "@components/ui/input";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@components/ui/item";
import { Label } from "@components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip";
import { copyToClipboard } from "@helpers/copyToClipboard";
import { ArrowTopRightOnSquareIcon, LinkIcon } from "@heroicons/react/16/solid";
import { DocumentDuplicateIcon, SparklesIcon } from "@heroicons/react/24/outline";

interface DnsProvider {
  name: string;
  logo?: React.ReactNode;
  guideUrl: string;
}

const DNS_PROVIDERS: DnsProvider[] = [
  {
    name: "Cloudflare",
    logo: <img src={CloudflareLogo} alt="Cloudflare" className="w-4" />,
    guideUrl: "#",
  },
  {
    name: "GoDaddy",
    logo: <img src={GoDaddyLogo} alt="GoDaddy" className="w-4" />,
    guideUrl: "#",
  },
  {
    name: "Namecheap",
    logo: <img src={NamecheapLogo} alt="Namecheap" className="w-4" />,
    guideUrl: "#",
  },
  {
    name: "AWS Route 53",
    logo: <img src={AwsLogo} alt="AWS Route 53" className="w-4" />,
    guideUrl: "#",
  },
];

export default function SetupCustomDomain() {
  const handleCopyPointsTo = async () => {
    await copyToClipboard("cname.launch10.ai"); // TODO: Add text from field
  };

  return (
    <div className="flex flex-col gap-5">
      <Item variant="outline" className="max-w-1/2 border-accent-yellow-300 bg-accent-yellow-100">
        <ItemMedia className="my-auto">
          <LinkIcon className="size-4 shrink-0 text-accent-yellow-700" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Custom Domain</ItemTitle>
          <ItemDescription className="text-base-600">
            Use your own domain name. You'll need to update DNS setting directly with your provider.
          </ItemDescription>
        </ItemContent>
      </Item>

      <div className="relative flex max-w-1/2 flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold leading-[18px] text-base-500">
            Enter your domain
          </Label>
          <button
            type="button"
            className="flex items-center gap-1 text-xs leading-4 text-base-400 hover:text-base-500"
          >
            <SparklesIcon className="size-3.5" />
            <span>Have questions?</span>
          </button>
        </div>
        <Input type="text" value={""} placeholder="examples.com" />
      </div>

      <Item variant="muted" className="max-w-[568px]">
        <ItemContent className="gap-2">
          <ItemTitle>What you need</ItemTitle>
          <ItemDescription>
            <div className="flex items-center gap-6">
              <div className="flex w-[79px] flex-col gap-1">
                <p className="text-xs font-medium leading-4 text-base-400">Record Name</p>
                <p className="text-sm leading-[18px] text-base-500">CNAME</p>
              </div>
              <div className="flex w-[79px] flex-col gap-1">
                <p className="text-xs font-medium leading-4 text-base-400">Host</p>
                <p className="text-sm leading-[18px] text-base-500">www</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium leading-4 text-base-400">Points to</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm leading-[18px] text-base-500">cname.launch10.ai</p>
                  <Tooltip delayDuration={500}>
                    <TooltipTrigger>
                      <button
                        type="button"
                        onClick={handleCopyPointsTo}
                        className="text-base-500 hover:text-base-600"
                      >
                        <DocumentDuplicateIcon className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Copy to clipboard</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </ItemDescription>
        </ItemContent>
      </Item>

      <Item variant="outline" className="max-w-[651px]">
        <ItemContent className="gap-1">
          <ItemTitle>Guides for common providers</ItemTitle>
          <ItemDescription className="flex flex-col gap-2">
            <span>We've prepared guides for popular DNS providers</span>
            <div className="grid grid-cols-4 gap-5">
              {DNS_PROVIDERS.map((provider) => (
                <div key={provider.name} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    {provider.logo}
                    <span className="text-sm font-semibold leading-[18px] text-base-600">
                      {provider.name}
                    </span>
                  </div>
                  <a
                    href={provider.guideUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs leading-4 text-primary-500 hover:text-primary-600"
                  >
                    <span>View official guide</span>
                    <ArrowTopRightOnSquareIcon className="size-4" />
                  </a>
                </div>
              ))}
            </div>
          </ItemDescription>
        </ItemContent>
      </Item>
    </div>
  );
}
