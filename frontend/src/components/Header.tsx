import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { SiteMainIcon } from "@/components/ui/icons/SiteMainIcon";

export function Header() {
  return (
    <header className="bg-gray-900 border-b border-gray-800">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between px-4 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center mb-4 md:mb-0">
          <SiteMainIcon size="lg" />
          <span className="text-xl font-bold text-white">DebateHub</span>
        </Link>

        {/* Search */}
        <div className="relative w-full md:w-1/3">
          <Input
            placeholder="Search debates..."
            className="pl-10 bg-gray-800 text-white border-gray-700 focus:border-primary focus:ring-primary"
          />
          <Search className="absolute left-3 top-1/2 h-5 w-5 text-gray-400 -translate-y-1/2" />
        </div>

        {/* Nav */}
        <nav className="hidden md:flex items-center space-x-6 text-sm">
          <Link href="#" className="text-white hover:text-primary">
            Home
          </Link>
          <Link href="#" className="text-primary font-medium">
            Explore
          </Link>
          <Link href="#" className="text-white hover:text-primary">
            My Debates
          </Link>
          <Button asChild>
            <Link href="#">Start a Debate</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
