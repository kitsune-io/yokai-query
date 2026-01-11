# Auth integration (better-auth)

Yokai Query can integrate with better-auth and attach a Bearer token to all
requests made through `api`.

## Install

No extra install needed when using `yokai-query` (it bundles `better-auth`).

## Setup

Create your better-auth client as usual and bridge it into Yokai Query.

```ts
import { api, createBetterAuthBridge } from "yokai-query";
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
});

const auth = createBetterAuthBridge(authClient, {
  getTokenFromResult: (result) =>
    result?.token ?? result?.session?.token,
});

await auth.signIn({ email, password });
await auth.signInSocial({ provider: "google" });
await auth.signInOAuth2({ providerId: "instagram" });
await auth.requestPasswordReset({ email, redirectTo: "/reset-password" });
await auth.resetPassword({ newPassword: "secret", token: "..." });
await auth.changePassword({ currentPassword: "old", newPassword: "new" });

const me = await api.get("/me");
```

## Prerequisites

Before the front-end flow can work, make sure your backend is configured:

- `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are set in your environment.
- A Better Auth instance is created and exported (`auth`).
- The `/api/auth/*` route handler is mounted in your framework.
- Social providers are enabled (e.g. `socialProviders.google`) with client IDs
  and secrets.

## API

`createBetterAuthBridge(client, options)` returns:

- `register(payload)` -> calls `client.signUp.email`.
- `signIn(payload)` -> calls `client.signIn.email`.
- `signInSocial(payload)` -> calls `client.signIn.social`.
- `signInOAuth2(payload)` -> calls `client.signIn.oauth2` (Generic OAuth plugin).
- `signOut()` -> calls `client.signOut` and clears the token.
- `refreshSession()` -> calls `client.getSession` and syncs the token.
- `requestPasswordReset(payload)` -> calls `client.requestPasswordReset`.
- `resetPassword(payload)` -> calls `client.resetPassword`.
- `changePassword(payload)` -> calls `client.changePassword`.

Note: `signInOAuth2` requires the Generic OAuth client plugin to be enabled in
your Better Auth client setup.

Tip: In React apps you can also use `createAuthClient` from `better-auth/react`
if you want the built-in hooks.

Options:

- `getTokenFromResult(result)` -> extract token from sign-in/up response.
- `getTokenFromSession(session)` -> extract token from `getSession` response.
- `setToken(token)` -> override token storage (default uses Yokai Query token).
- `clearCacheOnSignOut` -> when true, clears the default cache on sign-out.

## Manual token control

If you manage auth yourself, you can set tokens directly:

```ts
import { setAuthToken, clearAuthToken } from "yokai-query";

setAuthToken("my-token");
clearAuthToken();
```
