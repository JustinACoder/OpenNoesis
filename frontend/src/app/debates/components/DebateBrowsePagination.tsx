import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type DebateBrowsePaginationProps = {
  currentPage: number;
  totalPages: number;
  createPageUrl: (page: number) => string;
};

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 5];
  }

  if (currentPage >= totalPages - 2) {
    return Array.from({ length: 5 }, (_, index) => totalPages - 4 + index);
  }

  return Array.from({ length: 5 }, (_, index) => currentPage - 2 + index);
}

export function DebateBrowsePagination({
  currentPage,
  totalPages,
  createPageUrl,
}: DebateBrowsePaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const visiblePages = getVisiblePages(currentPage, totalPages);

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={currentPage > 1 ? createPageUrl(currentPage - 1) : "#"}
            className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>

        {visiblePages.map((pageNum) => (
          <PaginationItem key={pageNum}>
            <PaginationLink
              href={createPageUrl(pageNum)}
              isActive={currentPage === pageNum}
            >
              {pageNum}
            </PaginationLink>
          </PaginationItem>
        ))}

        {visiblePages[visiblePages.length - 1] < totalPages && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}

        <PaginationItem>
          <PaginationNext
            href={currentPage < totalPages ? createPageUrl(currentPage + 1) : "#"}
            className={
              currentPage >= totalPages ? "pointer-events-none opacity-50" : ""
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
