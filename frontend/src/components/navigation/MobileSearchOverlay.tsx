"use client";

import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { useState, FormEvent } from "react";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { useRouter } from "next/navigation";

const MobileSearchOverlay = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { isMobileSearchOpen, setMobileSearchOpen } = useNavigation();
  const router = useRouter();

  if (!isMobileSearchOpen) {
    return null; // Don't render if the mobile menu is not open
  }

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Redirect to the search results page with the query
      const encodedQuery = encodeURIComponent(searchQuery.trim());
      router.push(`/search/?query=${encodedQuery}`);

      // Reset the states
      setSearchQuery("");
      setMobileSearchOpen(false);
    }
  };

  return (
    <div className="md:hidden fixed inset-0 z-50 bg-background">
      <div className="flex items-center h-16 px-4 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileSearchOpen(false)}
          className="mr-2"
        >
          <X className="h-5 w-5" />
        </Button>
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              autoFocus
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default MobileSearchOverlay;
