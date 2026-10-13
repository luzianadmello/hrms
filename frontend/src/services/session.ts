import api from "./api";
import { clearSession } from "../utils/auth";

/**
 * Logs out for real:
 *  1. tells the server to revoke the token (token_version is bumped, so the
 *     JWT stops working everywhere, not just in this browser)
 *  2. removes the token from the browser
 *
 * Step 2 always runs, even if the request fails (offline, token already
 * expired), so the user is never stuck "logged in" on the client.
 */
export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } catch {
    // Expired / already revoked / server unreachable: nothing more to do.
  } finally {
    clearSession();
  }
}