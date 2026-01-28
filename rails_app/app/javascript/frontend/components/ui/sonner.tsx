import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-[#2E9E72]" />,
        info: <InfoIcon className="size-4 text-[#2E9E72]" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "font-['Plus_Jakarta_Sans',sans-serif] !rounded-lg !border !p-4 !shadow-lg",
          success: "!bg-[#D9F4E9] !border-[#2E9E72] !text-[#0F1113]",
          info: "!bg-[#D9F4E9] !border-[#2E9E72] !text-[#0F1113]",
          error: "!bg-red-50 !border-red-500 !text-[#0F1113]",
          title: "!font-semibold !text-base !leading-5",
          description: "!font-normal !text-sm !leading-[18px] !text-[#0F1113]",
          closeButton: "!bg-transparent !border-none !text-[#0F1113] hover:!text-[#0F1113]/70",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
