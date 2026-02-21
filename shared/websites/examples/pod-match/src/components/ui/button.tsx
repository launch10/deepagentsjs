import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-bold font-body uppercase tracking-wide border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all focus-visible:outline-none focus-visible:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] focus-visible:translate-x-[-2px] focus-visible:translate-y-[-2px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        destructive:
          "bg-destructive text-destructive-foreground",
        outline:
          "bg-background text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground",
        ghost: "border-0 shadow-none hover:bg-accent hover:text-accent-foreground hover:shadow-none hover:translate-x-0 hover:translate-y-0",
        link: "border-0 shadow-none text-primary underline-offset-4 hover:underline hover:shadow-none hover:translate-x-0 hover:translate-y-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
