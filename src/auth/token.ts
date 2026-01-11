let authToken: string | undefined;

export const setAuthToken = (token?: string) => {
  authToken = token;
};

export const clearAuthToken = () => {
  authToken = undefined;
};

export const getAuthToken = () => authToken;
