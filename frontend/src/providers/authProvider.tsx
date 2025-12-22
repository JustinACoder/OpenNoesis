"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { getProjectOpenDebateApiGetCurrentUserObjectQueryKey } from "@/lib/api/general";
import {
  useDeleteAllauthClientV1AuthSession,
  useGetAllauthClientV1AuthSession,
} from "@/lib/api/authentication-current-session";
import { usePostAllauthClientV1AuthLogin } from "@/lib/api/authentication-account";
import type {
  AuthenticationResponse,
  Flow,
  SessionGoneResponse,
  User,
} from "@/lib/models";

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
      error: AuthenticationResponse | SessionGoneResponse | null;
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
  const {
    data: sessionData,
    isLoading,
    error,
  } = useGetAllauthClientV1AuthSession("browser", {
    query: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: true,
    },
  });

  // Determine auth status based on the user query
  const authStatus: AuthStatus = useMemo(() => {
    if (isLoading) return "loading";
    if (error) return "unauthenticated";
    if (sessionData) return "authenticated";
    return "unauthenticated";
  }, [isLoading, error, sessionData]);

  const isEmailPendingVerification = useMemo(() => {
    // Check if there is a flow with id "verify_email" that is pending
    if (!error) return false;
    const flows = error.data.flows as Flow[];
    return flows.some((f) => f.id === "verify_email" && f.is_pending === true);
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
  }, [authStatus, error]);
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
