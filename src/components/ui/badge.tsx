import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-300 ease-out hover:scale-105 cursor-default focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--accent-soft)] text-[var(--accent-text)] shadow-2xs hover:bg-[var(--accent-soft)]/80",
        secondary:
          "border-transparent bg-[var(--glass-2)] text-secondary-foreground hover:bg-[var(--glass-hi)]",
        destructive:
          "border-transparent bg-[var(--bad-soft)] text-[var(--bad)] shadow-2xs hover:bg-[var(--bad-soft)]/80",
        outline: "border-[var(--line-2)] text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
