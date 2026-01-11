import { createFetch } from "@better-fetch/fetch";
import { getAuthToken } from "./auth/token";

export const api = createFetch({
  baseURL: "/api",
  throw: true,
  auth: {
    type: "Bearer",
    token: () => getAuthToken(),
  },
  retry: {
    type: "linear",
    attempts: 3,
    delay: 300,
  },
});
