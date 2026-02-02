import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import {
  PaginationFooterProvider,
  type PaginationFooterLayout,
} from "./PaginationFooterContext";

export interface RootProps {
  children: ReactNode;
  /** Layout variant - "container" for Ads, "full-bleed" for Website */
  layout?: PaginationFooterLayout;
  /** Override pending state (auto-detected from WorkflowProvider if not provided) */
  isPending?: boolean;
  /** Override back availability (auto-detected from WorkflowProvider if not provided) */
  canGoBack?: boolean;
  /** Override forward availability (auto-detected from WorkflowProvider if not provided) */
  canGoForward?: boolean;
  /** Additional classes for the outer container */
  className?: string;
}

/**
 * Container layout - sticky footer with border and shadow (used in Ads)
 */
function ContainerLayout({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={twMerge(
        "sticky bottom-0 mt-3",
        "bg-background border-t border-neutral-200 py-4 px-6",
        "shadow-[9px_-16px_26.1px_1px_#74767A12]",
        className
      )}
    >
      <div className="flex items-center justify-between">{children}</div>
    </div>
  );
}

/**
 * Full-bleed layout - grid-based with styled border (used in Website)
 */
function FullBleedLayout({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={twMerge("shrink-0 relative z-10 bg-background", className)}>
      {/* Border line - fades on left, extends to right edge of screen */}
      <div className="grid grid-cols-[1fr_3fr] gap-x-[3%] px-[2.5%]">
        <div />
        <div
          className="h-px bg-neutral-200 -ml-8 -mr-[2.5vw] shadow-[0px_-16px_26px_0px_rgba(15,17,19,0.06)]"
          style={{
            maskImage: "linear-gradient(to right, transparent, black 32px)",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 32px)",
          }}
        />
      </div>

      {/* Button content */}
      <div className="grid grid-cols-[1fr_3fr] gap-x-[3%] px-[2.5%] py-4">
        <div />
        <div className="flex items-center justify-between pr-[2.5%]">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * PaginationFooter.Root - Provides context and renders layout.
 *
 * Auto-detects WorkflowProvider context if present. Props override context values.
 *
 * @example Inside WorkflowProvider (Ads)
 * ```tsx
 * <PaginationFooter.Root layout="container">
 *   <PaginationFooter.BackButton onClick={handleBack} />
 *   <PaginationFooter.Actions>
 *     <PaginationFooter.ActionButton onClick={handleContinue}>
 *       Continue
 *     </PaginationFooter.ActionButton>
 *   </PaginationFooter.Actions>
 * </PaginationFooter.Root>
 * ```
 *
 * @example Outside WorkflowProvider (Website)
 * ```tsx
 * <PaginationFooter.Root
 *   layout="full-bleed"
 *   isPending={isLoading}
 *   canGoBack={true}
 * >
 *   {children}
 * </PaginationFooter.Root>
 * ```
 */
export function Root({
  children,
  layout = "container",
  isPending,
  canGoBack,
  canGoForward,
  className,
}: RootProps) {
  const Layout = layout === "full-bleed" ? FullBleedLayout : ContainerLayout;

  return (
    <PaginationFooterProvider
      layout={layout}
      isPending={isPending}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
    >
      <Layout className={className}>{children}</Layout>
    </PaginationFooterProvider>
  );
}
