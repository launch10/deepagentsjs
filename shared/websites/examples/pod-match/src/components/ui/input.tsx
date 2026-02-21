import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full border-4 border-foreground bg-background px-4 py-2 text-base font-body shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-foreground/40 focus-visible:outline-none focus-visible:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] focus-visible:translate-x-[-2px] focus-visible:translate-y-[-2px] disabled:cursor-not-allowed disabled:opacity-50 transition-all md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
