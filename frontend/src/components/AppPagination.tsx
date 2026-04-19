"use client";

import type { MouseEvent } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type AppPaginationProps = {
  currentPage: number;
  totalPages: number;
  getPageHref?: (page: number) => string;
  hrefConfig?: {
    basePath: string;
    pageParam?: string;
    omitPageOnFirst?: boolean;
    extraQuery?: Record<string, string>;
  };
  onPageChange?: (page: number) => void;
  className?: string;
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

function getDisabledClassName(disabled: boolean, interactive: boolean): string {
  if (!disabled && interactive) {
    return "cursor-pointer";
  }

  if (disabled && interactive) {
    return "pointer-events-none opacity-50 cursor-not-allowed";
  }

  if (disabled) {
    return "pointer-events-none opacity-50";
  }

  return "";
}

export function AppPagination({
  currentPage,
  totalPages,
  getPageHref,
  hrefConfig,
  onPageChange,
  className,
}: AppPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const interactive = typeof onPageChange === "function";
  const visiblePages = getVisiblePages(currentPage, totalPages);
  const createHref = (page: number) => {
    if (getPageHref) {
      return getPageHref(page);
    }

    if (!hrefConfig) {
      return "#";
    }

    const params = new URLSearchParams(hrefConfig.extraQuery);
    const pageParam = hrefConfig.pageParam ?? "page";
    const omitPageOnFirst = hrefConfig.omitPageOnFirst ?? true;

    if (page > 1 || !omitPageOnFirst) {
      params.set(pageParam, page.toString());
    } else {
      params.delete(pageParam);
    }

    const queryString = params.toString();
    return queryString ? `${hrefConfig.basePath}?${queryString}` : hrefConfig.basePath;
  };

  const buildPageProps = (page: number, disabled = false) => ({
    href: createHref(page),
    onClick: onPageChange
      ? (event: MouseEvent<HTMLAnchorElement>) => {
          event.preventDefault();
          if (!disabled) {
            onPageChange(page);
          }
        }
      : undefined,
  });

  return (
    <div className={className}>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              {...buildPageProps(currentPage - 1, currentPage <= 1)}
              className={getDisabledClassName(currentPage <= 1, interactive)}
            />
          </PaginationItem>

          {visiblePages[0] > 1 && (
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          )}

          {visiblePages.map((pageNum) => (
            <PaginationItem key={pageNum}>
              <PaginationLink
                {...buildPageProps(pageNum)}
                isActive={currentPage === pageNum}
                className={interactive ? "cursor-pointer" : undefined}
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
              {...buildPageProps(currentPage + 1, currentPage >= totalPages)}
              className={getDisabledClassName(currentPage >= totalPages, interactive)}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
