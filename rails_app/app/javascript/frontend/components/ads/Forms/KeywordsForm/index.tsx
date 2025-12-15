import { FieldSet } from "@components/ui/field";
import KeywordTargetingForm from "./KeywordTargetingForm";
import { useStageInit } from "@hooks/useStageInit";

export default function KeywordsForm() {
  useStageInit("keywords");

  return (
    <div className="border border-neutral-300 border-t-0 rounded-b-2xl bg-white">
      <div className="py-8 pl-9 pr-[97px] flex flex-col gap-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold leading-[22px]">Keyword Targeting</h2>
          <p className="text-xs text-base-300">
            Keywords are the words and phrases people search for on Google. Choosing the right ones
            helps your ads reach the right customers at the right time.
          </p>
        </div>
        <FieldSet>
          <KeywordTargetingForm />
        </FieldSet>
      </div>
    </div>
  );
}
