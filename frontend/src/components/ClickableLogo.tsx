import Link from "next/link";
import { SiteMainIcon } from "@/components/ui/icons/SiteMainIcon";

const ClickableLogo = () => (
  <Link href="/" className="flex items-center mb-4 md:mb-0">
    <SiteMainIcon size="lg" />
    <span className="text-xl font-bold text-white">DebateHub</span>
  </Link>
);
export default ClickableLogo;
