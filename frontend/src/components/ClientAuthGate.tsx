"use client";

import { useAuthState } from "@/providers/authProvider";
import React from "react";

export function ClientAuthGate({ children }: { children: React.ReactNode }) {
  const { authStatus } = useAuthState();

  if (authStatus !== "authenticated") {
    return null;
  }
  return <>{children}</>;
}
