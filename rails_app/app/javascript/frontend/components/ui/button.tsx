import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-base font-normal font-sans leading-5 overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-base-500 border border-base-500 text-white hover:bg-base-600 hover:border-base-600",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "bg-neutral-background border border-neutral-300 text-base-500 hover:border-neutral-500",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-base-500 border border-transparent hover:border-neutral-500",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "p-3",
        sm: "px-3 py-2 text-sm leading-[18px]",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
