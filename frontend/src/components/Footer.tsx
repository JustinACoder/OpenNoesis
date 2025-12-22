import Link from "next/link";
import { SiteMainIcon } from "@/components/ui/icons/SiteMainIcon";

export function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 mt-12 py-8">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between">
        {/* Brand */}
        <div className="mb-4 md:mb-0 flex items-center">
          <SiteMainIcon size="md" />
          <div>
            <p className="text-lg font-semibold text-white">DebateHub</p>
            <p className="text-sm text-gray-400">
              Expanding minds through thoughtful debate
            </p>
          </div>
        </div>

        {/* Social */}
        <div className="flex space-x-6 text-gray-400">
          <p className="text-sm">Socials coming soon!</p>
        </div>
      </div>

      <div className="border-t border-gray-800 mt-6 pt-6">
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
