import { FieldSet } from "@components/ui/field";
import CalloutsForm from "./CalloutsForm";
import StructuredSnippetsForm from "./StructuredSnippetsForm";
import { useStageInit } from "@hooks/useStageInit";

export default function HighlightsForm() {
  useStageInit("highlights");

  return (
    <div className="border border-neutral-300 border-t-0 rounded-b-2xl bg-white">
      <div className="py-8 pl-9 pr-[97px] flex flex-col gap-6">
        <h2 className="text-lg font-semibold">Highlights</h2>
        <p className="text-sm text-base-400">
          Highlights add useful information to your ads, like a phone number, location, specific
          website links, and more. They make your ad larger and give customers more reasons to
          click.
        </p>
        <FieldSet>
          <CalloutsForm />
          <StructuredSnippetsForm />
        </FieldSet>
      </div>
    </div>
  );
}
