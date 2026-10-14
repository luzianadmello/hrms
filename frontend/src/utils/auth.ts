import { clearPermissions } from "./permissions";

const ROLE_KEY = "role_id";

// The login token now lives in HttpOnly cookies that JavaScript can't read.
// Only the role id is kept here, as a UI hint. The server decides what is allowed.
export function getRoleId(): number {
  return Number(localStorage.getItem(ROLE_KEY));
}

export function setRoleId(roleId: number | string) {
  localStorage.setItem(ROLE_KEY, String(Number(roleId)));
}

/** Removes only this app's key (not unrelated localStorage data). */
export function clearSession() {
  localStorage.removeItem(ROLE_KEY);
  clearPermissions();
}