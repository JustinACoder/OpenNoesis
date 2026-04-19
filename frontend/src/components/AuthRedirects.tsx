"use client";

import { Button } from "@/components/ui/button";
import { useAuthState } from "@/providers/authProvider";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, LoaderCircle } from "lucide-react";
import React, { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getUrlParam } from "@/lib/utils";
import { getGetAllauthClientV1AuthSessionQueryKey } from "@/lib/api/authentication-current-session";
import { useQueryClient } from "@tanstack/react-query";
import { isRetryableTransportError } from "@/lib/apiError";

interface ChildrenInput {
  children: React.ReactNode;
}

const AuthRequired = ({ children }: ChildrenInput) => {
  const { authStatus, error } = useAuthState();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isRecoverableSessionError = isRetryableTransportError(error);

  useEffect(() => {
    // If the user is authenticated, we can redirect them to the next URL
    if (authStatus === "unauthenticated" && !isRecoverableSessionError) {
      const nextUrl = getUrlParam("next") || "/";
      router.push(`/login?next=${encodeURIComponent(nextUrl)}`);
    }
  }, [authStatus, isRecoverableSessionError, router]);

  if (authStatus === "loading") {
    // Return a centered loading spinner in the middle of the parent
    return (
      <div className="flex items-center justify-center h-100 text-primary">
        <LoaderCircle className="size-10 animate-spin" />
      </div>
    );
  }

  if (isRecoverableSessionError) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-2xl">
          <AlertCircleIcon />
          <AlertTitle>We couldn&apos;t refresh your session</AlertTitle>
          <AlertDescription>
            <p>
              The session check failed due to a temporary network or browser
              interruption. Retry the request or go to login if the problem
              persists.
            </p>
            <div className="mt-4 flex gap-3">
              <Button
                onClick={() =>
                  queryClient.refetchQueries({
                    queryKey: getGetAllauthClientV1AuthSessionQueryKey("browser"),
                  })
                }
              >
                Retry
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const nextUrl = getUrlParam("next") || "/";
                  router.push(`/login?next=${encodeURIComponent(nextUrl)}`);
                }}
              >
                Go to login
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-2xl">
          <AlertCircleIcon />
          <AlertTitle>Error loading user information</AlertTitle>
          <AlertDescription>
            An unexpected error occurred while fetching user data. Please try
            refreshing the page or contact support if the issue persists.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // If authenticated, render the children
  return children;
};

const GuestOnly = ({ children }: ChildrenInput) => {
  const { authStatus } = useAuthState();
  const router = useRouter();

  useEffect(() => {
    // If the user is authenticated, redirect them to the next URL
    if (authStatus === "authenticated") {
      const nextUrl = getUrlParam("next") || "/";
      router.push(nextUrl);
    }
  }, [authStatus, router]);

  // if (authStatus !== "unauthenticated") {
  //   // Return a centered loading spinner in the middle of the parent
  //   return (
  //     <div className="flex items-center justify-center h-100 text-primary">
  //       <LoaderCircle className="size-10 animate-spin" />
  //     </div>
  //   );
  // }

  // If unauthenticated, render the children
  return children;
};

export { AuthRequired, GuestOnly };
