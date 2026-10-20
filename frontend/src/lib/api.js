import axios from "axios";

const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const API_BASE_URL = rawApiUrl.endsWith("/") ? rawApiUrl.slice(0, -1) : rawApiUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 60000,
  withCredentials: false,
});

// Attach JWT token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 → redirect to login (only if not already on login page)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("access_token");
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

/**
 * Render Keep-Alive: Ping /health every 10 minutes to prevent Render free-tier
 * from spinning down the server (which causes 50-90s cold start delays).
 * Uses a no-auth plain fetch to avoid JWT dependency at module load time.
 */
const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
function startKeepAlivePing() {
  const ping = () => {
    fetch(`${API_BASE_URL}/health`, { method: "GET" }).catch(() => {});
  };
  ping(); // immediate ping on first load
  setInterval(ping, PING_INTERVAL_MS);
}
// Only ping in browser context
if (typeof window !== "undefined") {
  startKeepAlivePing();
}

export default api;
