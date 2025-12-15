import { Field, FieldGroup, FieldSet } from "@components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@components/ui/input-group";
import { Label } from "@components/ui/label";
import { Info, Sparkles } from "lucide-react";
import HeadlinesForm from "./HeadlinesForm";
import DescriptionsForm from "./DescriptionsForm";
import { useStageInit } from "@hooks/useStageInit";

export default function ContentForm() {
  useStageInit("content");

  return (
    <div className="border border-neutral-300 border-t-0 rounded-b-2xl bg-white">
      <div className="p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold leading-[22px]">Content</h2>
          <p className="text-xs text-base-300">
          Content is the core of your ad. Think of billboard headlines. They describe the problem
          your business solves, and encourage users to click to learn more.
          </p>
        </div>
        <FieldSet className="gap-4">
          <FieldGroup className="w-[405px]">
            <Field>
              <Label className="flex items-center gap-2 text-base-600">
                <span className="font-semibold">Ad Group Name</span>
                <Info size={12} className="text-base-300" />
              </Label>
              <InputGroup>
                <InputGroupInput placeholder="Ad Group Name" defaultValue="Ad Group Name" />
                <InputGroupAddon align="inline-end">
                  <Sparkles />
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </FieldGroup>
          <HeadlinesForm />
          <DescriptionsForm />
        </FieldSet>
      </div>
    </div>
  );
}
