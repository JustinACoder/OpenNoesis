"use client";

import { useAuth } from "@/providers/authProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import React, { useEffect } from "react";

interface ChildrenInput {
  children: React.ReactNode;
}

const AuthRequired = ({ children }: ChildrenInput) => {
  const { authStatus } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/";

  useEffect(() => {
    // If the user is authenticated, we can redirect them to the next URL
    if (authStatus === "unauthenticated") {
      router.push(`/login?next=${encodeURIComponent(nextUrl)}`);
    }
  }, [authStatus, router, nextUrl]);

  if (authStatus !== "loading") {
    // Return a centered loading spinner in the middle of the parent
    return (
      <div className="flex items-center justify-center h-100 text-primary">
        <LoaderCircle className="size-10 animate-spin" />
      </div>
    );
  }

  // If authenticated, render the children
  return children;
};

const GuestOnly = ({ children }: ChildrenInput) => {
  const { authStatus } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/";

  useEffect(() => {
    // If the user is authenticated, redirect them to the next URL
    if (authStatus === "authenticated") {
      router.push(nextUrl);
    }
  }, [authStatus, router, nextUrl]);

  if (authStatus !== "unauthenticated") {
    // Return a centered loading spinner in the middle of the parent
    return (
      <div className="flex items-center justify-center h-100 text-primary">
        <LoaderCircle className="size-10 animate-spin" />
      </div>
    );
  }

  // If unauthenticated, render the children
  return children;
};

export { AuthRequired, GuestOnly };
