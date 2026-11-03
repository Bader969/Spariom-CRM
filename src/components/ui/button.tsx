import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-95",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,var(--accent-hi),var(--accent))] text-[var(--accent-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_10px_22px_-12px_var(--accent)] hover:-translate-y-[1px] hover:brightness-105",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:brightness-110",
        outline:
          "border border-[var(--line-2)] bg-[var(--glass-2)] text-[var(--ink)] shadow-xs hover:bg-[var(--glass-hi)] hover:text-foreground",
        secondary:
          "bg-[var(--glass-2)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--line)] hover:bg-[var(--glass-hi)]",
        ghost: "hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-[10px] px-3 text-xs",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10 rounded-[14px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
