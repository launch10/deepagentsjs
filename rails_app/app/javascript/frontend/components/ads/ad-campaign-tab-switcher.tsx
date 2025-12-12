import { twMerge } from "tailwind-merge";

interface Tab {
  id: string;
  label: string;
}

interface AdCampaignTabSwitcherProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export default function AdCampaignTabSwitcher({
  tabs,
  activeTab,
  onChange,
}: AdCampaignTabSwitcherProps) {
  return (
    <div className="flex rounded-t-2xl border-neutral-300 border border-b-0 overflow-hidden">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={twMerge(
            "flex-1 py-3 text-base-400 border-b border-b-neutral-300 bg-background",
            activeTab === tab.id && "border-b-yellow-700 text-base-600 bg-accent-yellow-100"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
