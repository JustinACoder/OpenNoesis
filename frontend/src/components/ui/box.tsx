import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const containerVariants = cva(
  "rounded-2xl border border-border/80 bg-card/82 text-card-foreground transition-[border-color,background-color,box-shadow,transform] backdrop-blur-sm",
  {
    variants: {
      variant: {
        default: "shadow-none",
        subtle: "bg-background/68 border-border/65",
        contrast: "bg-secondary/58 border-border",
        info: "bg-primary/8 border-primary/25",
        warning: "bg-amber-500/10 border-amber-400/25",
        success: "bg-emerald-500/10 border-emerald-400/25",
        danger: "bg-destructive/10 border-destructive/25",
      },
      hover: {
        true: "hover:-translate-y-0.5 hover:border-border hover:bg-card hover:shadow-[0_14px_40px_-28px_rgba(15,23,42,0.85)]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      hover: false,
    },
  },
);

export interface BoxProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof containerVariants> {
  asChild?: boolean;
}

const Box = React.forwardRef<HTMLDivElement, BoxProps>(
  ({ className, variant, hover, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp
        ref={ref}
        data-slot="rounded-container"
        className={cn(containerVariants({ variant, hover, className }))}
        {...props}
      />
    );
  },
);
Box.displayName = "Box";

export { Box, containerVariants };
