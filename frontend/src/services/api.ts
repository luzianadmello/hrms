
import axios, {
  type InternalAxiosRequestConfig,
} from "axios";
import { clearSession } from "../utils/auth";

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const baseURL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL,
  withCredentials: true,
});

let refreshing: Promise<unknown> | null = null;

function refreshSession(): Promise<unknown> {
  if (!refreshing) {
    refreshing = axios
      .post(
        `${baseURL}/auth/refresh`,
        null,
        { withCredentials: true }
      )
      .finally(() => {
        refreshing = null;
      });
  }

  return refreshing;
}

function goToLogin(): void {
  clearSession();

  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

api.interceptors.response.use(
  (response) => response,

  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const original = error.config as
      | RetriableRequestConfig
      | undefined;

    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    const url = original?.url ?? "";
    const path = window.location.pathname;

    const isAuthCall =
      url.includes("/auth/login") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/logout");

    // Refresh only for unauthorized requests, never for permission errors.
    if (
      status === 401 &&
      original &&
      !isAuthCall &&
      !original._retry
    ) {
      original._retry = true;

      try {
        await refreshSession();
      } catch (refreshError: unknown) {
        const refreshStatus = axios.isAxiosError(refreshError)
          ? refreshError.response?.status
          : undefined;

        // An explicit 401 from refresh means the session is invalid.
        if (refreshStatus === 401) {
          goToLogin();
        }

        // Network errors and server errors do not automatically log out.
        return Promise.reject(error);
      }

      try {
        // Retry the original request once with the refreshed cookies.
        return await api(original);
      } catch (retryError: unknown) {
        const retryStatus = axios.isAxiosError(retryError)
          ? retryError.response?.status
          : undefined;

        if (retryStatus === 401) {
          goToLogin();
        }

        return Promise.reject(retryError);
      }
    }

    // Preserve the existing forced-password-change behavior.
    if (
      status === 403 &&
      detail === "Password change required" &&
      path !== "/change-password"
    ) {
      window.location.replace("/change-password");
    }

    return Promise.reject(error);
  }
);

export default api;
