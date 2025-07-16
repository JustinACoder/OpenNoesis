import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const containerVariants = cva(
  "rounded-lg border bg-gradient-to-br transition-colors",
  {
    variants: {
      variant: {
        default: "from-gray-800 to-gray-900 border-gray-700",
        subtle: "from-gray-900 to-gray-800 border-gray-800",
        contrast: "from-zinc-800 to-zinc-950 border-gray-600",
        info: "from-cyan-900 to-cyan-950 border-cyan-700",
        warning: "from-amber-800 to-amber-900 border-amber-700",
        success: "from-emerald-800 to-emerald-900 border-emerald-700",
        danger: "from-red-800 to-red-900 border-red-700",
      },
      hover: {
        true: "hover:-translate-y-1 hover:shadow-lg transition-transform duration-300 ease-in-out",
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
