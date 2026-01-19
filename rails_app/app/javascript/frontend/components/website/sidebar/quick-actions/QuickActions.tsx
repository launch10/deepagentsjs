import { useState } from "react";
import { CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { Separator } from "@components/ui/separator";
import { AnimatePresence, motion } from "framer-motion";
import QuickActionButton from "./QuickActionButton";
import { ColorPaletteSection } from "@components/brainstorm/conversation-page/brand-panel/ColorPaletteSection";
import { ProjectImagesSection } from "@components/brainstorm/conversation-page/brand-panel/ProjectImagesSection";
import ImproveCopy from "@components/quick-actions/improve-copy/ImproveCopy";
import { DocumentTextIcon, PhotoIcon, SwatchIcon } from "@heroicons/react/24/solid";

export type QuickActionType = "colors" | "images" | "copy";

export interface QuickActionsViewProps {
  activeAction?: QuickActionType | null;
  onActionClick?: (action: QuickActionType) => void;
  settingsContent?: React.ReactNode;
}

const quickActions = [
  {
    id: "colors" as const,
    label: "Change Colors",
    icon: SwatchIcon,
    iconColor: "text-accent-yellow-600",
  },
  {
    id: "images" as const,
    label: "Swap Images",
    icon: PhotoIcon,
    iconColor: "text-accent-green-500",
  },
  {
    id: "copy" as const,
    label: "Improve Copy",
    icon: DocumentTextIcon,
    iconColor: "text-primary-400",
  },
];

export function QuickActionsView({
  activeAction,
  onActionClick,
  settingsContent,
}: QuickActionsViewProps) {
  return (
    <div className="flex flex-col">
      <CardHeader className="px-4 py-4">
        <CardTitle className="text-lg font-semibold font-serif">Landing Page Designer</CardTitle>
        <CardDescription className="flex flex-col gap-1.5">
          <div className="font-medium text-sm text-base-400">Quick Actions</div>
          <div className="flex flex-col gap-2.5">
            {quickActions.map((action) => (
              <QuickActionButton
                key={action.id}
                label={action.label}
                icon={action.icon}
                iconColor={action.iconColor}
                isActive={activeAction === action.id}
                onClick={() => onActionClick?.(action.id)}
              />
            ))}
          </div>
        </CardDescription>
      </CardHeader>
      <AnimatePresence>
        {settingsContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <Separator className="bg-neutral-300" />
            {settingsContent}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function QuickActions() {
  const [activeAction, setActiveAction] = useState<QuickActionType | null>();

  const handleActionClick = (action: QuickActionType) => {
    // Toggle off if clicking the same action, otherwise switch to new action
    setActiveAction((prev) => (prev === action ? null : action));
  };

  // Render settings content based on active action
  const renderSettingsContent = () => {
    switch (activeAction) {
      case "colors":
        return <ColorPaletteSection />;
      case "images":
        return <ProjectImagesSection />;
      case "copy":
        return <ImproveCopy />;
      default:
        return null;
    }
  };

  return (
    <QuickActionsView
      activeAction={activeAction}
      onActionClick={handleActionClick}
      settingsContent={renderSettingsContent()}
    />
  );
}
