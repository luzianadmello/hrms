import api from "./api";
import { clearSession } from "../utils/auth";

/**
 * Logs out for real:
 *  1. tells the server to delete this browser's refresh token and clear the
 *     login cookies
 *  2. removes the role hint from the browser
 *
 * Step 2 always runs, even if the request fails (offline, server down), so
 * the user is never stuck "logged in" on the client.
 */
export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } catch {
    // Already logged out / server unreachable: nothing more to do.
  } finally {
    clearSession();
  }
}