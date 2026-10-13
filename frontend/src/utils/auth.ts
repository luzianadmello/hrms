const TOKEN_KEY = "access_token";
const ROLE_KEY = "role_id";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRoleId(): number {
  return Number(localStorage.getItem(ROLE_KEY));
}

export function setRoleId(roleId: number | string) {
  localStorage.setItem(ROLE_KEY, String(Number(roleId)));
}

export function setSession(token: string, roleId?: number | string) {
  localStorage.setItem(TOKEN_KEY, token);
  if (roleId !== undefined) {
    setRoleId(roleId);
  }
}

/** Removes only this app's auth keys (not unrelated localStorage data). */
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

function readExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Milliseconds until the token expires (null if it can't be read). */
export function getTokenExpiresInMs(token: string): number | null {
  const expiry = readExpiry(token);
  return expiry === null ? null : expiry - Date.now();
}

/** Reads the `exp` claim so we can reject expired tokens without a request. */
export function isTokenExpired(token: string): boolean {
  const expiry = readExpiry(token);
  return expiry === null || expiry <= Date.now();
}

export function isLoggedIn(): boolean {
  const token = getToken();
  return !!token && !isTokenExpired(token);
}