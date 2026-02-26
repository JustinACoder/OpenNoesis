import Link from "next/link";
import { SiteLogo } from "@/components/SiteLogo";

const ClickableLogo = () => (
  <Link href="/">
    <SiteLogo size="lg" />
  </Link>
);
export default ClickableLogo;
