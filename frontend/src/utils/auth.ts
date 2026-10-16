import { clearPermissions } from "./permissions";

const ROLE_KEY = "role_id";

// Login tokens live in HttpOnly cookies that JavaScript can't read, and
// permissions are kept in memory (see permissions.ts). Nothing about the
// session is stored in localStorage any more.

/** Clears the in-memory permissions and removes any old leftover key. */
export function clearSession() {
  localStorage.removeItem(ROLE_KEY); // leftover from older versions
  clearPermissions();
}
