"use client";

import { LoaderCircle, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DebateGrid } from "@/components/DebateGrid";
import { DebateCard } from "@/components/DebateCard";
import { AppPagination } from "@/components/AppPagination";
import { Separator } from "@/components/ui/separator";
import { useDebateApiSearchDebates } from "@/lib/api/debate";
import { PagedDebateSchema } from "@/lib/models";

interface SearchClientProps {
  query: string;
  currentPage: number;
  initialResults: PagedDebateSchema | null;
}

const SearchClient = ({
  query,
  currentPage,
  initialResults,
}: SearchClientProps) => {

  const {
    data: searchResults,
    isLoading,
    isError,
  } = useDebateApiSearchDebates({
    query,
    page: currentPage >= 1 ? currentPage : 1,
  }, {
    query: {
      initialData: initialResults ?? undefined,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  });

  const debates = searchResults?.items || [];
  const totalResults = searchResults?.count || 0;
  const RESULTS_PER_PAGE = 25; /* make sure it matches the backend */
  const totalPages = Math.ceil(totalResults / RESULTS_PER_PAGE);

  // Helper function to create pagination URLs
  const createPageUrl = (page: number) => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (page > 1) params.set("page", page.toString());
    return `/search?${params.toString()}`;
  };

  return (
    <div className="container mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Search Results Header */}
      <div className="mb-8">
        {query ? (
          <>
            <h1 className="text-3xl font-bold mb-2">Search Results</h1>
            <p className="text-muted-foreground">
              Results for &ldquo;{query}&rdquo;
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold mb-2">Search</h1>
            <p className="text-muted-foreground">No search query provided</p>
          </>
        )}
      </div>
      <Separator className="mb-8" />

      {/* Results Section */}
      <div className="space-y-6">
        {/* Results Header */}
        {query && (
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {isLoading ? "Searching..." : `${totalResults} results found`}
            </h2>
            {totalPages > 1 && (
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </div>
        )}

        {/* Loading State */}
        {query && isLoading && (
          <div className="flex items-center justify-center h-64">
            <LoaderCircle className="size-10 animate-spin text-primary" />
          </div>
        )}

        {/* Error State */}
        {query && isError && !isLoading && (
          <Alert variant="destructive">
            <AlertTitle>Error loading search results</AlertTitle>
            <AlertDescription>
              There was an issue fetching the search results. Please try again
              later. If the problem persists, contact support.
            </AlertDescription>
          </Alert>
        )}

        {/* No Results */}
        {!isLoading && !isError && query && debates.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No results found</h3>
            <p className="text-muted-foreground mb-4">
              No debates found matching &ldquo;{query}&rdquo;
            </p>
            <p className="text-sm text-muted-foreground">
              Try searching with different keywords or check your spelling.
            </p>
          </div>
        )}

        {/* Results Grid */}
        {!isLoading && !isError && debates.length > 0 && (
          <>
            <DebateGrid>
              {debates.map((debate) => (
                <DebateCard key={debate.id} {...debate} />
              ))}
            </DebateGrid>

            {/* Pagination */}
            {totalPages > 1 && (
              <AppPagination
                currentPage={currentPage}
                totalPages={totalPages}
                getPageHref={createPageUrl}
                className="flex justify-center pt-8"
              />
            )}
          </>
        )}

        {/* Empty State for no query */}
        {!query && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Start Searching</h3>
            <p className="text-muted-foreground">
              Use the search bar in the navigation to find debates on topics
              you&apos;re interested in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchClient;
