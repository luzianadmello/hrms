import axios from "axios";
import { clearSession } from "../utils/auth";

// Use localhost (not 127.0.0.1) so the cookies are same-site with the frontend.
const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL,
  withCredentials: true,
});

// If several requests fail with 401 at the same moment, they all wait for ONE
// refresh call instead of each firing their own (refresh tokens are single-use).
let refreshing: Promise<unknown> | null = null;

function refreshSession() {
  if (!refreshing) {
    refreshing = axios
      .post(`${baseURL}/auth/refresh`, null, { withCredentials: true })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

function goToLogin() {
  clearSession();
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    const url: string = original?.url ?? "";
    const path = window.location.pathname;

    const isAuthCall =
      url.includes("/auth/login") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/logout");

    if (status === 401 && original && !isAuthCall && !original._retry) {
      original._retry = true;
      try {
        await refreshSession();
        return api(original); // retry the original request with the new cookie
      } catch {
        // Another tab may have refreshed already: try the request once more
        try {
          return await api(original);
        } catch {
          goToLogin();
          return Promise.reject(error);
        }
      }
    }

    if (
      status === 403 &&
      detail === "Password change required" &&
      path !== "/change-password"
    ) {
      window.location.href = "/change-password";
    }

    return Promise.reject(error);
  }
);

export default api;
