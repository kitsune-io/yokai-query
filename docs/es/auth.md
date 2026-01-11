# Auth (better-auth)

Yokai Query se puede integrar con better-auth y adjuntar un token Bearer a
todas las requests hechas con `api`.

## Install

No necesitas instalar nada extra cuando usas `yokai-query` (incluye `better-auth`).

## Setup

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

## Requisitos previos

Antes de que el flujo en el front funcione, el backend debe estar listo:

- `BETTER_AUTH_SECRET` y `BETTER_AUTH_URL` configurados.
- Instancia de Better Auth creada y exportada como `auth`.
- Handler montado en `/api/auth/*`.
- Providers sociales habilitados (ej. `socialProviders.google`) con sus keys.

## API

`createBetterAuthBridge(client, options)` devuelve:

- `register(payload)` -> llama `client.signUp.email`.
- `signIn(payload)` -> llama `client.signIn.email`.
- `signInSocial(payload)` -> llama `client.signIn.social`.
- `signInOAuth2(payload)` -> llama `client.signIn.oauth2` (plugin Generic OAuth).
- `signOut()` -> llama `client.signOut` y limpia el token.
- `refreshSession()` -> llama `client.getSession` y sincroniza el token.
- `requestPasswordReset(payload)` -> llama `client.requestPasswordReset`.
- `resetPassword(payload)` -> llama `client.resetPassword`.
- `changePassword(payload)` -> llama `client.changePassword`.

Nota: `signInOAuth2` requiere habilitar el plugin Generic OAuth en el cliente de
Better Auth.

Tip: En React tambien podes usar `createAuthClient` desde `better-auth/react`
si queres los hooks.

Opciones:

- `getTokenFromResult(result)` -> extraer token del resultado de sign in/up.
- `getTokenFromSession(session)` -> extraer token del `getSession`.
- `setToken(token)` -> override del almacenamiento de token.
- `clearCacheOnSignOut` -> si es true, limpia el cache default al cerrar sesión.

## Token manual

```ts
import { setAuthToken, clearAuthToken } from "yokai-query";

setAuthToken("my-token");
clearAuthToken();
```
