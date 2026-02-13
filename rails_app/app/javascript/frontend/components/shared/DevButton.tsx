import { Button, type ButtonProps } from "@components/ui/button";

/**
 * Dev-only button that only renders in development mode.
 * Red styling to make it obvious this is a dev/admin tool.
 */
export default function DevButton({ children, className, ...props }: ButtonProps) {
  if (!import.meta.env.DEV) return null;

  return (
    <Button
      variant="outline"
      className={`border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 ${className ?? ""}`}
      {...props}
    >
      {children}
    </Button>
  );
}
