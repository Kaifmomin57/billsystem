import axios from "axios";

const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const API_BASE_URL = rawApiUrl.endsWith("/") ? rawApiUrl.slice(0, -1) : rawApiUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 60000,
  withCredentials: false,
});

import toast from "react-hot-toast";

// Generate a random UUID v4 string
export function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Attach JWT token and auto-inject Idempotency-Key for financial writes (PRD Section 6)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const method = (config.method || "").toLowerCase();
  const url = config.url || "";
  const isFinancialWrite =
    (method === "post" && (url === "/bills" || url.endsWith("/bills"))) ||
    ((method === "post" || method === "put") && url.includes("/payment"));

  if (isFinancialWrite && !config.headers["Idempotency-Key"]) {
    config.headers["Idempotency-Key"] = generateUUID();
  }

  return config;
});

// Handle 401 (redirect to login) and 429 (Rate limit with Retry-After notification)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;

    if (status === 401) {
      localStorage.removeItem("access_token");
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    } else if (status === 429) {
      const retryAfter =
        err.response?.headers?.["retry-after"] ||
        err.response?.data?.retry_after ||
        5;
      const detail = err.response?.data?.detail || `Rate limit reached. Please wait ${retryAfter}s before retrying.`;
      toast.error(detail, { id: "rate-limit-toast", duration: 5000 });
      err.retryAfter = parseInt(retryAfter, 10);
    }

    return Promise.reject(err);
  }
);

/**
 * PRD Section 7: Poll durable background job until completion or failure.
 * @param {string} jobId - UUID of the background job
 * @param {Function} onProgress - Callback receiving { progress, status, message }
 * @param {number} intervalMs - Polling interval in ms (default 1200ms)
 * @param {number} maxAttempts - Max polling attempts before timeout (default 100)
 */
export async function pollJob(jobId, onProgress, intervalMs = 1200, maxAttempts = 100) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    try {
      const res = await api.get(`/jobs/${jobId}`);
      const job = res.data;
      if (onProgress) {
        onProgress({
          progress: job.progress || 0,
          status: job.status,
          message: job.progress_message || "",
        });
      }

      if (job.status === "completed" || job.status === "ready" || job.status === "needs_review") {
        return job;
      }
      if (job.status === "failed") {
        throw new Error(job.error_message || "Background task failed.");
      }
    } catch (e) {
      if (e.message && e.message.includes("Background task failed")) throw e;
      // Network hiccup during poll: wait and retry
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Job polling timed out. Please refresh or check recent activity.");
}

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
