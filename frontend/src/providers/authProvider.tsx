"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { getProjectOpenDebateApiGetCurrentUserObjectQueryKey } from "@/lib/api/general";
import {
  useDeleteAllauthClientV1AuthSession,
  useGetAllauthClientV1AuthSession,
  getGetAllauthClientV1AuthSessionQueryKey,
} from "@/lib/api/authentication-current-session";
import { usePostAllauthClientV1AuthLogin } from "@/lib/api/authentication-account";
import type { User } from "@/lib/models";
import { hasPendingFlow, isRetryableTransportError } from "@/lib/apiError";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type SessionUserInfo = Omit<User, "id" | "username"> & {
  id?: number; // ID is always a number in our case
  username: string; // username is always present
};

type AuthState =
  | {
      authStatus: Extract<AuthStatus, "authenticated">;
      isEmailPendingVerification: boolean;
      user: SessionUserInfo;
      error: null;
    }
  | {
      authStatus: Exclude<AuthStatus, "authenticated">;
      isEmailPendingVerification: boolean;
      user: undefined;
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
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getGetAllauthClientV1AuthSessionQueryKey("browser"),
      }),
      queryClient.invalidateQueries({
        queryKey: getProjectOpenDebateApiGetCurrentUserObjectQueryKey(),
      }),
    ]);
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
  const {
    data: sessionData,
    isLoading,
    error,
  } = useGetAllauthClientV1AuthSession("browser", {
    query: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: true,
      retry: (failureCount, retryError) =>
        isRetryableTransportError(retryError) && failureCount < 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  });

  // Determine auth status based on the session query
  const authStatus: AuthStatus = useMemo(() => {
    // Keep the previous authenticated state only when a background refetch
    // fails due to a transient transport issue.
    if (sessionData && (!error || isRetryableTransportError(error))) {
      return "authenticated";
    }

    // Show loading if we're fetching on initial load.
    if (isLoading) return "loading";

    return "unauthenticated";
  }, [isLoading, sessionData, error]);

  const isEmailPendingVerification = useMemo(() => {
    if (!error) return false;
    return hasPendingFlow(error, "verify_email");
  }, [error]);

  const {
    login: loginMutation,
    logout: logoutMutation,
    invalidateUser,
  } = useLoginLogoutActions(queryClient);

  const state = useMemo<AuthState>(() => {
    if (authStatus === "authenticated") {
      return {
        authStatus,
        isEmailPendingVerification,
        user: sessionData!.data.user as SessionUserInfo,
        error: null,
      };
    } else {
      return {
        authStatus,
        isEmailPendingVerification,
        user: undefined,
        error,
      };
    }
  }, [authStatus, error, isEmailPendingVerification, sessionData]);
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
