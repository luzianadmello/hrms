// Permissions come from the database via /auth/me. They live in memory only
// (never localStorage) and are a UI hint: the API enforces everything.
let permissions = new Set<string>();
let roleName = "";

export function setPermissions(list: string[], role: string) {
  permissions = new Set(list);
  roleName = role;
}

export function clearPermissions() {
  permissions = new Set();
  roleName = "";
}

export function can(permission: string): boolean {
  return permissions.has(permission);
}

export function canAny(...list: string[]): boolean {
  return list.some((p) => permissions.has(p));
}

export function getRoleName(): string {
  return roleName;
}

/** "ADMIN" -> "Admin", "HR" -> "HR", "TEAM_LEAD" -> "Team lead" */
export function getRoleLabel(): string {
  if (!roleName) return "";
  if (roleName === "HR") return "HR";
  return roleName.charAt(0) + roleName.slice(1).toLowerCase().replace(/_/g, " ");
}

// Employees see only their own data; team viewers see their reports.
export const isEmployeeView = () =>
  !canAny("employee.view_all", "employee.view_team");

export const isTeamViewOnly = () =>
  can("employee.view_team") && !can("employee.view_all");
