import { useCallback, useState } from "react";
import { MutateOptions } from "../types";
import { useQueryStore } from "../store";

export type UseMutationOptions<TVars, TResult> = Omit<
  MutateOptions<TVars, TResult>,
  "variables"
> & {
  onSettled?: (
    result: TResult | undefined,
    error: unknown | undefined,
    vars: TVars
  ) => void;
};

export function useMutation<TVars, TResult>(
  opts: UseMutationOptions<TVars, TResult>
): {
  mutate: (variables: TVars) => Promise<TResult>;
  isLoading: boolean;
  error: unknown;
  data: TResult | undefined;
  reset: () => void;
  cancel: () => void;
  status: "idle" | "loading" | "success" | "error";
} {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [data, setData] = useState<TResult | undefined>(undefined);

  const mutate = useCallback(
    async (variables: TVars) => {
      setIsLoading(true);
      setError(undefined);

      try {
        const result = await useQueryStore.getState().mutate<TVars, TResult>({
          ...opts,
          variables,
          onSuccess: (r, v) => {
            opts.onSuccess?.(r, v);
          },
          onError: (e, v) => {
            opts.onError?.(e, v);
          },
        });

        setData(result);
        opts.onSettled?.(result, undefined, variables);
        return result;
      } catch (e) {
        setError(e);
        opts.onSettled?.(undefined, e, variables);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [opts]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(undefined);
    setData(undefined);
  }, []);

  const cancel = useCallback(() => {
    if (opts.mutationKey) {
      useQueryStore.getState().cancelMutation(opts.mutationKey);
    }
  }, [opts.mutationKey]);

  const status: "idle" | "loading" | "success" | "error" = isLoading
    ? "loading"
    : error
      ? "error"
      : data !== undefined
        ? "success"
        : "idle";

  return { mutate, isLoading, error, data, reset, cancel, status };
}
