"use client";

import { useAuthState } from "@/providers/authProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircleIcon, LoaderCircle } from "lucide-react";
import React, { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ChildrenInput {
  children: React.ReactNode;
}

const AuthRequired = ({ children }: ChildrenInput) => {
  const { authStatus, error } = useAuthState();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/";

  useEffect(() => {
    // If the user is authenticated, we can redirect them to the next URL
    if (authStatus === "unauthenticated") {
      router.push(`/login?next=${encodeURIComponent(nextUrl)}`);
    }
  }, [authStatus, router, nextUrl]);

  if (authStatus === "loading") {
    // Return a centered loading spinner in the middle of the parent
    return (
      <div className="flex items-center justify-center h-100 text-primary">
        <LoaderCircle className="size-10 animate-spin" />
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
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/";

  useEffect(() => {
    // If the user is authenticated, redirect them to the next URL
    if (authStatus === "authenticated") {
      router.push(nextUrl);
    }
  }, [authStatus, router, nextUrl]);

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
