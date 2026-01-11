import { clearAuthToken, setAuthToken } from "./token";
import { useQueryStore } from "../store/client";

type BetterAuthSignIn<TEmail = unknown, TSocial = unknown, TOAuth2 = unknown> =
  | ((payload: TEmail) => Promise<unknown>)
  | {
      email?: (payload: TEmail) => Promise<unknown>;
      social?: (payload: TSocial) => Promise<unknown>;
      oauth2?: (payload: TOAuth2) => Promise<unknown>;
    };

type BetterAuthSignUp<TEmail = unknown> =
  | ((payload: TEmail) => Promise<unknown>)
  | {
      email?: (payload: TEmail) => Promise<unknown>;
    };

export type BetterAuthClient<
  TSignIn = unknown,
  TSignUp = unknown,
  TSession = unknown,
  TSocialSignIn = unknown,
  TOAuth2SignIn = unknown,
  TRequestPasswordReset = unknown,
  TResetPassword = unknown,
  TChangePassword = unknown,
> = {
  signIn?: BetterAuthSignIn<TSignIn, TSocialSignIn, TOAuth2SignIn>;
  signUp?: BetterAuthSignUp<TSignUp>;
  signOut?: () => Promise<unknown>;
  getSession?: () => Promise<TSession | null | undefined>;
  requestPasswordReset?: (payload: TRequestPasswordReset) => Promise<unknown>;
  resetPassword?: (payload: TResetPassword) => Promise<unknown>;
  changePassword?: (payload: TChangePassword) => Promise<unknown>;
};

export type BetterAuthBridgeOptions = {
  getTokenFromResult?: (result: unknown) => string | undefined;
  getTokenFromSession?: (session: unknown) => string | undefined;
  setToken?: (token?: string) => void;
  clearCacheOnSignOut?: boolean;
};

const resolveToken = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined;
  const anyValue = value as any;
  return (
    anyValue.token ??
    anyValue.accessToken ??
    anyValue.session?.token ??
    anyValue.session?.accessToken ??
    anyValue.data?.token ??
    anyValue.data?.session?.token
  );
};

export const createBetterAuthBridge = <
  TSignIn = unknown,
  TSignUp = unknown,
  TSession = unknown,
  TSocialSignIn = unknown,
  TOAuth2SignIn = unknown,
  TRequestPasswordReset = unknown,
  TResetPassword = unknown,
  TChangePassword = unknown,
>(
  client: BetterAuthClient<
    TSignIn,
    TSignUp,
    TSession,
    TSocialSignIn,
    TOAuth2SignIn,
    TRequestPasswordReset,
    TResetPassword,
    TChangePassword
  >,
  options?: BetterAuthBridgeOptions
) => {
  const setToken = options?.setToken ?? setAuthToken;
  const getTokenFromResult = options?.getTokenFromResult ?? resolveToken;
  const getTokenFromSession = options?.getTokenFromSession ?? resolveToken;
  const clearCacheOnSignOut = options?.clearCacheOnSignOut ?? true;
  const resolveSignInEmail = () => {
    if (typeof client.signIn === "function") return client.signIn;
    return client.signIn?.email;
  };
  const resolveSignInSocial = () => {
    if (!client.signIn || typeof client.signIn === "function") return undefined;
    return client.signIn.social;
  };
  const resolveSignInOAuth2 = () => {
    if (!client.signIn || typeof client.signIn === "function") return undefined;
    return client.signIn.oauth2;
  };
  const signUpEmail = () => {
    if (typeof client.signUp === "function") return client.signUp;
    return client.signUp?.email;
  };

  const syncFromResult = (result: unknown) => {
    const token = getTokenFromResult(result);
    if (token) setToken(token);
    return result;
  };

  const refreshSession = async () => {
    if (!client.getSession) return undefined;
    const session = await client.getSession();
    const token = getTokenFromSession(session);
    setToken(token);
    return session;
  };

  const register = async (payload: TSignUp) => {
    const handler = signUpEmail();
    if (!handler) {
      throw new Error("better-auth client missing signUp.email");
    }
    const result = await handler(payload);
    return syncFromResult(result);
  };

  const signIn = async (payload: TSignIn) => {
    const handler = resolveSignInEmail();
    if (!handler) {
      throw new Error("better-auth client missing signIn.email");
    }
    const result = await handler(payload);
    return syncFromResult(result);
  };

  const signInSocial = async (payload: TSocialSignIn) => {
    const handler = resolveSignInSocial();
    if (!handler) {
      throw new Error("better-auth client missing signIn.social");
    }
    const result = await handler(payload);
    return syncFromResult(result);
  };
  const signInOAuth2 = async (payload: TOAuth2SignIn) => {
    const handler = resolveSignInOAuth2();
    if (!handler) {
      throw new Error("better-auth client missing signIn.oauth2");
    }
    const result = await handler(payload);
    return syncFromResult(result);
  };

  const signOut = async () => {
    const result = await client.signOut?.();
    clearAuthToken();
    if (clearCacheOnSignOut) {
      useQueryStore.getState().clear();
    }
    return result;
  };
  const requestPasswordReset = async (payload: TRequestPasswordReset) => {
    if (!client.requestPasswordReset) {
      throw new Error("better-auth client missing requestPasswordReset");
    }
    return client.requestPasswordReset(payload);
  };
  const resetPassword = async (payload: TResetPassword) => {
    if (!client.resetPassword) {
      throw new Error("better-auth client missing resetPassword");
    }
    return client.resetPassword(payload);
  };
  const changePassword = async (payload: TChangePassword) => {
    if (!client.changePassword) {
      throw new Error("better-auth client missing changePassword");
    }
    return client.changePassword(payload);
  };

  return {
    client,
    register,
    signIn,
    signInSocial,
    signInOAuth2,
    signOut,
    refreshSession,
    requestPasswordReset,
    resetPassword,
    changePassword,
  };
};
