import Link from "next/link";
import { SiteLogo } from "@/components/SiteLogo";

export function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 mt-12">
      {/* Brand */}
      <div className="container mx-auto px-4 flex flex-wrap items-baseline gap-x-4 py-6">
        <SiteLogo size="md" />
        <p className="text-sm text-gray-400">
          Expanding minds through thoughtful debate
        </p>
      </div>

      <div className="border-t border-gray-800 py-4">
        <nav className="container mx-auto px-4 flex flex-wrap gap-4 text-sm text-gray-400">
          {["About", "Community Guidelines", "Terms", "Contact"].map(
            (label) => (
              <Link key={label} href="#" className="hover:text-primary">
                {label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </footer>
  );
}
