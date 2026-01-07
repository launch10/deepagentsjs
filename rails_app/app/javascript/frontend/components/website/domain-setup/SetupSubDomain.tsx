import { Button } from "@components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@components/ui/input-group";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@components/ui/item";
import { Label } from "@components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip";
import { copyToClipboard } from "@helpers/copyToClipboard";
import { DocumentDuplicateIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { BoltIcon, CheckCircleIcon } from "@heroicons/react/24/solid";
import { useForm } from "react-hook-form";
import { z } from "zod";

export default function SetupSubDomain() {
  const isDomainAvailable = true; // TODO: Add actual availability check

  const subdomainSchema = z.object({
    subdomain: z
      .string()
      .min(1, "Subdomain is required")
      .max(255, "Subdomain must be less than 255 characters")
      .regex(/^[a-zA-Z0-9]+$/, "Subdomain can only contain letters and numbers"),
  });

  const {
    register,
    watch,
    formState: { errors, isValid },
  } = useForm({
    defaultValues: {
      subdomain: "",
    },
    mode: "onChange",
    resolver: zodResolver(subdomainSchema),
  });

  const handleCopySubdomain = async () => {
    await copyToClipboard(`${watch("subdomain")}.launch10.ai`);
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
            <InputGroupInput {...register("subdomain")} placeholder="mysite" className="text-xs" />
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

        {errors.subdomain && (
          <div className="flex items-center gap-1 justify-start text-destructive text-xs">
            <XCircleIcon className="size-4" />
            <span>{errors.subdomain.message}</span>
          </div>
        )}

        {isDomainAvailable && isValid && (
          <div className="flex items-center gap-1 justify-start text-success-500 text-xs">
            <CheckCircleIcon className="size-4" />
            <span>Available: {`${watch("subdomain")}.launch10.ai`}</span>
          </div>
        )}
      </div>
    </div>
  );
}
