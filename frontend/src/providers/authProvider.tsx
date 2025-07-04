"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useDeleteAllauthClientV1AuthSession } from "@/lib/api/authentication-current-session";
import {
  getProjectOpenDebateApiIsAuthenticatedQueryKey,
  useProjectOpenDebateApiIsAuthenticated,
} from "@/lib/api/general";
import { usePostAllauthClientV1AuthLogin } from "@/lib/api/authentication-account";
import { useQueryClient } from "@tanstack/react-query";

// Define the shape of the context
type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextType {
  authStatus: AuthStatus;
  login: ReturnType<typeof usePostAllauthClientV1AuthLogin>;
  logout: ReturnType<typeof useDeleteAllauthClientV1AuthSession>;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// The provider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Get the query client to manage cache
  const queryClient = useQueryClient();

  // Fetch initial auth status
  const { data, isLoading } = useProjectOpenDebateApiIsAuthenticated({
    query: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: true, // Refetch when the window regains focus
    },
  });

  const loginMutation = usePostAllauthClientV1AuthLogin({
    mutation: {
      onSuccess: async (data) => {
        console.log("Login successful:", data);
        // We invalidate the auth status query to ensure it reflects the new state
        await queryClient.invalidateQueries({
          queryKey: getProjectOpenDebateApiIsAuthenticatedQueryKey(),
        });
      },
    },
  });

  const logoutMutation = useDeleteAllauthClientV1AuthSession({
    mutation: {
      onSuccess: async () => {
        console.log("Logout successful");
        // Invalidate the auth status query to reflect the logged-out state
        await queryClient.invalidateQueries({
          queryKey: getProjectOpenDebateApiIsAuthenticatedQueryKey(),
        });
      },
    },
  });

  const value: AuthContextType = useMemo<AuthContextType>(() => {
    return {
      authStatus: isLoading
        ? "loading"
        : data?.is_authenticated
          ? "authenticated"
          : "unauthenticated",
      login: loginMutation,
      logout: logoutMutation,
    };
  }, [isLoading, data, loginMutation, logoutMutation]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
