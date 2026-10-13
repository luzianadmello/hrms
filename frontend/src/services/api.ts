import axios from "axios";

import { clearSession, getToken } from "../utils/auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v1",
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    const url: string = error.config?.url ?? "";
    const path = window.location.pathname;

    if (status === 401) {
      // A wrong password on the login form is also a 401. Do NOT reload the
      // page there, or the "invalid email or password" message disappears.
      const isLoginRequest = url.includes("/auth/login");

      if (!isLoginRequest) {
        clearSession();

        if (path !== "/login") {
          window.location.href = "/login";
        }
      }
    } else if (
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