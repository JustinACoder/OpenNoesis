import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  QueryClient,
  QueryKey,
  UseMutationOptions,
  UseMutationResult,
  useQueryClient,
} from "@tanstack/react-query";
import { AxiosRequestConfig } from "axios";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function useOptimisticMutation<
  TData,
  TVariables,
  TResponse = void,
  TError = void,
>(
  mutationHook: (
    options?: {
      mutation?: UseMutationOptions<
        TResponse,
        TError,
        TVariables,
        { previousData?: TData }
      >;
      request?: AxiosRequestConfig;
    },
    queryClient?: QueryClient,
  ) => UseMutationResult<TResponse, TError, TVariables>,
  config: {
    queryKey: QueryKey;
    updateFn: (oldData: TData, variables: TVariables) => TData;
    successUpdateFn?: (
      oldData: TData,
      serverData: TResponse,
      variables: TVariables,
    ) => TData;
    shouldInvalidate?: boolean;
  },
) {
  const queryClient = useQueryClient();

  return mutationHook({
    mutation: {
      onMutate: async (variables: TVariables) => {
        console.debug("[OptimisticMutation] onMutate - Variables:", variables);
        await queryClient.cancelQueries({ queryKey: config.queryKey });
        const previousData = queryClient.getQueryData<TData>(config.queryKey);
        console.debug(
          "[OptimisticMutation] Previous data snapshot:",
          previousData,
        );

        queryClient.setQueryData(config.queryKey, (old: TData) =>
          old ? config.updateFn(old, variables) : old,
        );

        return { previousData };
      },
      onSuccess: (data: TResponse, variables: TVariables) => {
        console.debug("[OptimisticMutation] onSuccess - Server data:", data);
        if (config.successUpdateFn) {
          queryClient.setQueryData(config.queryKey, (old: TData) =>
            old ? config.successUpdateFn!(old, data, variables) : old,
          );
        }
      },
      onError: (error: TError, variables: TVariables, context) => {
        console.error("[OptimisticMutation] onError - Error:", error);
        if (context?.previousData !== undefined) {
          console.debug(
            "[OptimisticMutation] Rolling back to previous data:",
            context.previousData,
          );
          queryClient.setQueryData<TData>(
            config.queryKey,
            context.previousData,
          );
        }
      },
      onSettled: () => {
        console.debug(
          "[OptimisticMutation] onSettled - Invalidating query:",
          config.queryKey,
        );

        if (config.shouldInvalidate) {
          console.debug(
            "[OptimisticMutation] Invalidating query:",
            config.queryKey,
          );

          queryClient
            .invalidateQueries({ queryKey: config.queryKey })
            .then((r) =>
              console.debug(
                "[OptimisticMutation] Query invalidated:",
                config.queryKey,
                r,
              ),
            );
        }
      },
    },
  });
}
