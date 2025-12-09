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
    <div className="flex rounded-t-2xl border-[#D3D2D0] border border-b-0 overflow-hidden">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={twMerge(
            "flex-1 py-3 text-[#74767A] border-b bg-background",
            activeTab === tab.id && "border-b-[#BF873F] text-[#3d3c3a] bg-[#FAECDB]"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
