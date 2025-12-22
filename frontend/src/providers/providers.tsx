"use client";

import { ReactNode, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  HydrationBoundary,
} from "@tanstack/react-query";
import { AuthProvider } from "@/providers/authProvider";
import { DehydratedState } from "@tanstack/query-core";

interface ProvidersProps {
  dehydratedState?: DehydratedState;
  children: ReactNode;
}

export default function Providers({
  dehydratedState,
  children,
}: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>
        <AuthProvider>{children}</AuthProvider>
      </HydrationBoundary>
    </QueryClientProvider>
  );
}
