import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { useAdsChatActions } from "@hooks/useAdsChat";
import { useFormRegistration } from "@hooks/useFormRegistration";

const budgetFormSchema = z.object({
  budget: z.number().min(1, "Budget must be at least $1"),
});

type BudgetFormData = z.infer<typeof budgetFormSchema>;

export default function DailyBudget() {
  const { sendMessage } = useAdsChatActions();

  const methods = useForm<BudgetFormData>({
    resolver: zodResolver(budgetFormSchema) as any,
    mode: "onChange",
    defaultValues: {
      budget: 500,
    },
  });

  useFormRegistration("settings", methods);

  const handleAskChat = () => {
    sendMessage("Suggest appropriate daily budget amounts for this ad campaign");
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold leading-[18px] text-base-500">
        Daily Budget (USD)
      </label>
      <div className="flex gap-3 items-center">
        <div className="relative w-[212px]">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs leading-4 text-neutral-400">
            $
          </span>
          <Controller
            name="budget"
            control={methods.control}
            render={({ field }) => (
              <input
                type="number"
                value={field.value}
                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                className="h-10 w-full rounded-lg border border-neutral-300 bg-white pl-7 pr-4 py-3 text-xs leading-4 text-base-500 outline-none focus:border-base-600"
              />
            )}
          />
        </div>
        <button
          type="button"
          onClick={handleAskChat}
          className="flex items-center gap-3 rounded-lg border border-[#5f7e78] bg-[#eaf5f3] px-4 py-[14px] hover:bg-[#dceee9] transition-colors"
        >
          <Sparkles className="h-4 w-4 text-[#0d342b]" />
          <span className="text-sm leading-[18px] text-[#081f1a]">
            Ask chat for recommendations
          </span>
        </button>
      </div>
      {methods.formState.errors.budget && (
        <span className="text-xs text-[#d14f34]">{methods.formState.errors.budget.message}</span>
      )}
    </div>
  );
}
