// Simple auth helpers for localStorage token management
export const authStorage = {
  getToken: () => localStorage.getItem("access_token"),
  setToken: (token) => localStorage.setItem("access_token", token),
  clearToken: () => localStorage.removeItem("access_token"),
  isAuthenticated: () => !!localStorage.getItem("access_token"),
};
