import { Button } from "@components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@components/ui/input-group";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@components/ui/item";
import { Label } from "@components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip";
import { copyToClipboard } from "@helpers/copyToClipboard";
import { BoltIcon } from "@heroicons/react/16/solid";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
// import { CheckCircleIcon } from "@heroicons/react/24/solid";

export default function SetupSubDomain() {
  const handleCopySubdomain = async () => {
    await copyToClipboard("mysite.launch10.ai"); // TODO: Add text from field
  };

  return (
    <div className="flex flex-col gap-5">
      <Item variant="outline" className="max-w-1/2 border-primary-300 bg-primary-100">
        <ItemMedia className="my-auto">
          <BoltIcon className="size-4 fill-primary-500" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Free & Instant</ItemTitle>
          <ItemDescription className="text-base-600">
            Get started immediately with a free Launch10 subdomain. Perfect for testing and
            launching quickly.
          </ItemDescription>
        </ItemContent>
      </Item>

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-semibold leading-[18px] text-base-500">
          Name your subdomain
        </Label>
        <div className="flex w-full items-center gap-2">
          <InputGroup>
            <InputGroupInput
              type="text"
              value={""}
              // onChange={(e) => handleDomainChange(e.target.value)}
              placeholder="mysite"
              className="h-10 flex-1 rounded-r-none border-r-0 border-neutral-300 px-4 py-3 text-xs leading-4 text-base-500"
            />
            <InputGroupAddon align="inline-end">
              <span className="text-xs leading-4 text-base-400">.launch10.ai</span>
            </InputGroupAddon>
          </InputGroup>
          <Tooltip delayDuration={500}>
            <TooltipTrigger>
              <Button variant="ghost" size="icon" onClick={handleCopySubdomain}>
                <DocumentDuplicateIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy to clipboard</TooltipContent>
          </Tooltip>
        </div>

        {/* 
		// TODO: Add field validation
		<div className="flex items-center gap-1 justify-start text-success-500 text-xs">
          <CheckCircleIcon className="size-4" />
          <span>Available: paw-protraits.launch10.ai</span>
        </div> */}
      </div>
    </div>
  );
}
