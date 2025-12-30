import { useState } from "react";
import { CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { Separator } from "@components/ui/separator";
import { AnimatePresence, motion } from "framer-motion";
import QuickActionButton from "./QuickActionButton";
import {
  ColorPalettesView,
  type ColorPalette,
} from "@components/quick-actions/color-palettes/ColorPalettes";
import {
  ImagesManagerView,
  type ImageItem,
} from "@components/quick-actions/images-manager/ImagesManager";
import {
  ImproveCopyView,
  type CopyOption,
} from "@components/quick-actions/improve-copy/ImproveCopy";
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

const defaultPalettes: ColorPalette[] = [
  ["#43597f", "#9fc2d5", "#e6f9fa", "#e07655", "#2a3240"],
  ["#2f4554", "#4e9991", "#e5c577", "#e9a46b", "#d77558"],
  ["#de5470", "#f8d476", "#62d4a4", "#3f8ab0", "#183b4a"],
];

const defaultImages: ImageItem[] = [
  { id: "1" },
  { id: "2" },
  { id: "3" },
  { id: "4" },
  { id: "5" },
];

const defaultCopyOptions: CopyOption[] = [
  { id: "professional", label: "Make tone more professional" },
  { id: "friendly", label: "Make tone more friendly" },
  { id: "shorter", label: "Make copy shorter" },
];

export default function QuickActions() {
  const [activeAction, setActiveAction] = useState<QuickActionType | null>("colors");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>(["1", "2", "3"]);
  const totalPages = 2;

  const handleActionClick = (action: QuickActionType) => {
    // Toggle off if clicking the same action, otherwise switch to new action
    setActiveAction((prev) => (prev === action ? null : action));
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handleAddCustom = () => {
    console.log("Add custom palette");
  };

  const handlePaletteSelect = (palette: ColorPalette) => {
    console.log("Palette selected:", palette);
  };

  const handleImageSelect = (id: string) => {
    setSelectedImageIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleImageRemove = (id: string) => {
    setSelectedImageIds((prev) => prev.filter((i) => i !== id));
  };

  const handleImageUpload = () => {
    console.log("Upload image");
  };

  const handleCopyOptionSelect = (option: CopyOption) => {
    console.log("Copy option selected:", option);
  };

  // Render settings content based on active action
  const renderSettingsContent = () => {
    switch (activeAction) {
      case "colors":
        return (
          <ColorPalettesView
            palettes={defaultPalettes}
            currentPage={currentPage}
            totalPages={totalPages}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
            onAddCustom={handleAddCustom}
            onPaletteSelect={handlePaletteSelect}
          />
        );
      case "images":
        return (
          <ImagesManagerView
            images={defaultImages}
            selectedIds={selectedImageIds}
            onImageSelect={handleImageSelect}
            onImageRemove={handleImageRemove}
            onUpload={handleImageUpload}
          />
        );
      case "copy":
        return (
          <ImproveCopyView options={defaultCopyOptions} onOptionSelect={handleCopyOptionSelect} />
        );
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
