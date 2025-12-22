"use client";

import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const SearchBar = () => {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      console.log("Searching for:", query.trim());
      router.push(`/search/?query=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="hidden md:flex flex-1 max-w-2xl mx-8">
      <form onSubmit={handleSearch} className="w-full">
        <div className="relative flex h-10 items-stretch">
          <input
            type="text"
            placeholder="Search debates..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 h-full px-4 py-0 border border-r-0 rounded-l-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <Button
            type="submit"
            className="h-full px-4 rounded-l-none rounded-r-full border border-l-0 bg-muted hover:bg-muted/80"
            variant="outline"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SearchBar;
