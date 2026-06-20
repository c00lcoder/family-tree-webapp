import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:opacity-90",
        secondary:
          "bg-muted text-foreground hover:bg-border border border-border",
        outline:
          "border-2 border-border bg-transparent text-foreground hover:bg-muted",
        ghost: "bg-transparent hover:bg-muted text-foreground",
        destructive: "bg-destructive text-white hover:opacity-90",
      },
      size: {
        // Large, finger-friendly tap targets by default.
        default: "min-h-12 px-5 text-base",
        sm: "min-h-10 px-4 text-sm",
        lg: "min-h-14 px-7 text-lg",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
