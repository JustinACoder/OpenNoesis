"use client";

import { ReactNode, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
  HydrationBoundary,
} from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
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
  const router = useRouter();
  const pathname = usePathname();

  const handleError = (err: unknown) => {
    if (!isAxiosError(err)) {
      toast.error("An unexpected error occurred.");
      console.error("An unexpected error occurred:", err);
      return;
    }

    // Redirect to login if the error is an authentication error
    if (err.response?.status === 401 || err.response?.status === 410) {
      // If we find the meta.is_authenticated=true flag, we won't redirect as it is due to another reason
      if (err.response.data?.meta?.is_authenticated) {
        return;
      }

      // Otherwise, we are not authenticated, so redirect to login
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
    }
  };

  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: handleError,
        }),
        mutationCache: new MutationCache({
          onError: handleError,
        }),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>
        <AuthProvider>{children}</AuthProvider>
      </HydrationBoundary>
    </QueryClientProvider>
  );
}
