"use client";

import { useState } from "react";
import { useDebateApiListMyDebates } from "@/lib/api/debate";
import { AppPagination } from "@/components/AppPagination";
import { MyDebateCard } from "@/app/my-debates/components/MyDebateCard";
import { AlertCircleIcon, FolderPen, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function MyDebatesPage() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError } = useDebateApiListMyDebates({
    page,
  });

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Alert variant="destructive" className="mb-6 w-full">
        <AlertCircleIcon />
        <AlertTitle>Error loading debates</AlertTitle>
        <AlertDescription>
          An unexpected error occurred while loading your debates. Please try
          again later.
        </AlertDescription>
      </Alert>
    );
  }

  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(data.count / pageSize));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <FolderPen className="h-6 w-6" />
        <h1 className="text-2xl font-bold">My Debates</h1>
        <Badge variant="secondary" className="text-sm">
          {data.count}
        </Badge>
      </div>

      {data.items.length > 0 ? (
        <div className="divide-y">
          {data.items.map((debate) => (
            <MyDebateCard key={debate.id} debate={debate} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <FolderPen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="mb-2 text-lg font-medium">No debates yet</h2>
          <p className="text-muted-foreground">
            Debates you create will appear here so you can revisit and edit
            them.
          </p>
        </div>
      )}

      {totalPages > 1 ? (
        <AppPagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          className="flex justify-center pt-4"
        />
      ) : null}
    </div>
  );
}
