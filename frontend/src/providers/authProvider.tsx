"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
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

type AuthActions = ReturnType<typeof useLoginLogoutActions>;

// Create the contexts
const AuthStateContext = createContext<AuthState | undefined>(undefined);
const AuthActionsContext = createContext<AuthActions | undefined>(undefined);

const useLoginLogoutActions = (queryClient: QueryClient) => {
  const loginMutation = usePostAllauthClientV1AuthLogin();

  const logoutMutation = useDeleteAllauthClientV1AuthSession();

  const invalidateUser = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: getProjectOpenDebateApiGetCurrentUserObjectQueryKey(),
    });
  }, [queryClient]);

  return {
    login: loginMutation,
    logout: logoutMutation,
    invalidateUser,
  };
};

// The provider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  // Use the current user endpoint to determine auth status
  // The response now includes is_authenticated and is_anonymous fields
  const {
    data: user,
    isLoading,
    error,
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

  const {
    login: loginMutation,
    logout: logoutMutation,
    invalidateUser,
  } = useLoginLogoutActions(queryClient);

  const state = useMemo<AuthState>(
    () => ({ authStatus, user, isLoading, error }),
    [authStatus, user, isLoading, error],
  );
  const actions = useMemo(
    () => ({
      login: loginMutation,
      logout: logoutMutation,
      invalidateUser,
    }),
    [loginMutation, logoutMutation, invalidateUser],
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
