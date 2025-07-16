import Link from "next/link";
import { SiteMainIcon } from "@/components/ui/icons/SiteMainIcon";

const ClickableLogo = () => (
  <Link href="/" className="flex items-center space-x-2">
    <SiteMainIcon size="lg" />
    <span className="text-xl font-bold text-white">DebateHub</span>
  </Link>
);
export default ClickableLogo;
