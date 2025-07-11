"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useProjectOpenDebateApiGetCurrentUserObject,
  getProjectOpenDebateApiGetCurrentUserObjectQueryKey,
} from "@/lib/api/general";
import { useDeleteAllauthClientV1AuthSession } from "@/lib/api/authentication-current-session";
import { usePostAllauthClientV1AuthLogin } from "@/lib/api/authentication-account";
import type { CurrentUserResponse } from "@/lib/models";

// Define the shape of the context
type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextType {
  authStatus: AuthStatus;
  user: CurrentUserResponse | undefined;
  isLoading: boolean;
  error: unknown;
  login: ReturnType<typeof usePostAllauthClientV1AuthLogin>;
  logout: ReturnType<typeof useDeleteAllauthClientV1AuthSession>;
  refetchUser: () => void;
  invalidateUser: () => Promise<void>;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// The provider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  // Use the current user endpoint to determine auth status
  // The response now includes is_authenticated and is_anonymous fields
  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useProjectOpenDebateApiGetCurrentUserObject({
    query: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: true,
    },
  });

  // Determine auth status based on the user query
  const authStatus: AuthStatus = useMemo(() => {
    if (isLoading) return "loading";
    if (error) return "unauthenticated";
    if (user && user.is_authenticated) return "authenticated";
    return "unauthenticated";
  }, [isLoading, error, user]);

  const loginMutation = usePostAllauthClientV1AuthLogin({
    mutation: {
      onSuccess: async (data) => {
        console.log("Login successful:", data);
        await refetch();
      },
    },
  });

  const logoutMutation = useDeleteAllauthClientV1AuthSession({
    mutation: {
      onError: async (error) => {
        // Logout returns 401 on success as the session is deleted
        // It's a weird pattern, but anyway, we handle it here by refetching the user
        console.log("Logout successful:", error);
        await refetch();
      },
    },
  });

  const invalidateUser = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: getProjectOpenDebateApiGetCurrentUserObjectQueryKey(),
    });
  }, [queryClient]);

  const value: AuthContextType = useMemo(() => {
    return {
      authStatus,
      user,
      isLoading,
      error,
      login: loginMutation,
      logout: logoutMutation,
      refetchUser: refetch,
      invalidateUser,
    };
  }, [
    authStatus,
    user,
    isLoading,
    error,
    loginMutation,
    logoutMutation,
    refetch,
    invalidateUser,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
