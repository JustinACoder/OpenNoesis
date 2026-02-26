import { cn } from "@/lib/utils";

interface SiteLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
};

export const SiteLogo = ({ className, size = "md" }: SiteLogoProps) => {
  return (
    <span className={cn("font-bold", sizeClasses[size], className)}>
      <span className="text-white">Open</span>
      <span className="text-primary">Noesis</span>
    </span>
  );
};

export default SiteLogo;
