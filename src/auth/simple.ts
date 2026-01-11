import { createBetterAuthBridge } from "./betterAuth";

export type AuthBridgeFromEnvOptions = {
  baseURL?: string;
  plugins?: unknown[];
  clearCacheOnSignOut?: boolean;
};

const resolveDefaultBaseURL = () => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/auth`;
  }
  return "/api/auth";
};

export const createAuthBridgeFromEnv = async (
  options: AuthBridgeFromEnvOptions = {}
) => {
  let createAuthClient: (opts: {
    baseURL: string;
    plugins?: unknown[];
  }) => unknown;

  try {
    const mod = await import("better-auth/client");
    createAuthClient = (mod as any).createAuthClient;
    if (!createAuthClient) {
      throw new Error("better-auth/client did not export createAuthClient");
    }
  } catch (error) {
    throw new Error(
      "better-auth is required for createAuthBridgeFromEnv. Install it with `npm i better-auth`."
    );
  }

  const client = createAuthClient({
    baseURL: options.baseURL ?? resolveDefaultBaseURL(),
    plugins: options.plugins,
  });

  return createBetterAuthBridge(client as any, {
    clearCacheOnSignOut: options.clearCacheOnSignOut,
  });
};
