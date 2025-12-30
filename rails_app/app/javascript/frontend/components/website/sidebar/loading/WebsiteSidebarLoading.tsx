import { CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import LoadingStepPill, { type LoadingStepStatus } from "./WebsiteSidebarLoadingStepPill";
import {
  LightBulbIcon,
  PaintBrushIcon,
  ChatBubbleBottomCenterTextIcon,
  StarIcon,
  RectangleGroupIcon,
  PhotoIcon,
  SparklesIcon,
} from "@heroicons/react/24/solid";
import type { ComponentType, SVGProps } from "react";

interface LoadingStepConfig {
  id: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
}

const loadingSteps: LoadingStepConfig[] = [
  { id: "analyze", icon: LightBulbIcon, label: "Analyzing your ideas" },
  { id: "branding", icon: PaintBrushIcon, label: "Setting up branding & color" },
  { id: "copy", icon: ChatBubbleBottomCenterTextIcon, label: "Writing compelling copy" },
  { id: "hero", icon: StarIcon, label: "Designing hero section" },
  { id: "sections", icon: RectangleGroupIcon, label: "Adding additional sections" },
  { id: "images", icon: PhotoIcon, label: "Selecting the perfect images" },
  { id: "polish", icon: SparklesIcon, label: "Polishing site with final touches" },
];

export interface WebsiteSidebarLoadingProps {
  currentStep?: number;
}

function getStepStatus(stepIndex: number, currentStep: number): LoadingStepStatus {
  if (stepIndex < currentStep) return "completed";
  if (stepIndex === currentStep) return "in_progress";
  return "pending";
}

export default function WebsiteSidebarLoading({ currentStep = 0 }: WebsiteSidebarLoadingProps) {
  return (
    <CardHeader className="px-4 py-4">
      <CardTitle className="text-lg font-semibold font-serif">Landing Page Designer</CardTitle>
      <CardDescription className="flex flex-col gap-2 pt-1">
        {loadingSteps.map((step, index) => (
          <LoadingStepPill
            key={step.id}
            icon={step.icon}
            label={step.label}
            status={getStepStatus(index, currentStep)}
          />
        ))}
      </CardDescription>
    </CardHeader>
  );
}
