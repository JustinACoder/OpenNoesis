import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const iconVariants = cva("text-primary mr-2", {
  variants: {
    size: {
      sm: "h-6 w-6",
      md: "h-7 w-7",
      lg: "h-8 w-8",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

type IconVariantProps = VariantProps<typeof iconVariants>;

export const SiteMainIcon = ({ size = "md" }: IconVariantProps) => {
  return (
    <svg
      className={cn(iconVariants({ size }))}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
};
