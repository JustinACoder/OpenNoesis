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

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthState = {
  authStatus: AuthStatus;
  user: CurrentUserResponse | undefined;
  isLoading: boolean;
  error: unknown;
};

type AuthActions = {
  login: ReturnType<typeof usePostAllauthClientV1AuthLogin>;
  logout: ReturnType<typeof useDeleteAllauthClientV1AuthSession>;
  refetchUser: () => void;
  invalidateUser: () => Promise<void>;
};

// Create the contexts
const AuthStateContext = createContext<AuthState | undefined>(undefined);
const AuthActionsContext = createContext<AuthActions | undefined>(undefined);

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

  const state = useMemo<AuthState>(
    () => ({ authStatus, user, isLoading, error }),
    [authStatus, user, isLoading, error],
  );
  const actions = useMemo<AuthActions>(
    () => ({
      login: loginMutation,
      logout: logoutMutation,
      refetchUser: refetch,
      invalidateUser,
    }),
    [loginMutation, logoutMutation, refetch, invalidateUser],
  );

  return (
    <AuthStateContext.Provider value={state}>
      <AuthActionsContext.Provider value={actions}>
        {children}
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
};

export const useAuthState = () => {
  const v = useContext(AuthStateContext);
  if (!v) throw new Error("useAuthState must be used within AuthProvider");
  return v;
};

export const useAuthActions = () => {
  const v = useContext(AuthActionsContext);
  if (!v) throw new Error("useAuthActions must be used within AuthProvider");
  return v;
};
