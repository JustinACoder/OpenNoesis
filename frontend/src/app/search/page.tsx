import { Suspense } from "react";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import SearchClient from "@/app/search/components/SearchClient";
import { LoaderCircle } from "lucide-react";

function SearchFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <LoaderCircle className="size-10 animate-spin text-primary" />
    </div>
  );
}

// TODO: Instead of having a client component, the page could be client and we have a server layout
export default function SearchPage() {
  return (
    <NavigationOverlay>
      <Suspense fallback={<SearchFallback />}>
        <SearchClient />
      </Suspense>
    </NavigationOverlay>
  );
}
