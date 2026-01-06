import { cn } from "@lib/utils";

interface TextShimmerProps {
  children: string;
  className?: string;
  duration?: number;
  color?: string;
  shimmerColor?: string;
}

export function TextShimmer({
  children,
  className,
  duration = 2,
  color,
  shimmerColor,
}: TextShimmerProps) {
  const baseColor = color ?? "var(--color-neutral-500)";
  const highlightColor = shimmerColor ?? "var(--color-neutral-white)";

  return (
    <span
      className={cn("inline-block bg-clip-text text-transparent animate-shimmer", className)}
      style={{
        animationDuration: `${duration}s`,
        backgroundImage: `linear-gradient(to right, ${baseColor}, ${baseColor}, ${highlightColor}, ${baseColor}, ${baseColor})`,
        backgroundSize: "125px 100%",
        backgroundColor: baseColor,
      }}
    >
      {children}
    </span>
  );
}
