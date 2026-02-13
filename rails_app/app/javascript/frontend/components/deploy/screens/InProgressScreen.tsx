import LogoSpinner from "@components/ui/logo-spinner";

interface InProgressScreenProps {
  deployType: "website" | "campaign";
  currentTaskLabel?: string;
}

export default function InProgressScreen({ deployType, currentTaskLabel }: InProgressScreenProps) {
  const noun = deployType === "campaign" ? "campaign" : "website";

  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
      <div className="w-24 h-24">
        <LogoSpinner />
      </div>
      <h2 className="text-xl font-semibold text-base-900 mt-6">Launching your {noun}</h2>
      {currentTaskLabel && <p className="text-sm text-base-500 mt-2">{currentTaskLabel}</p>}
      <div className="flex items-center gap-1.5 mt-4">
        <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
