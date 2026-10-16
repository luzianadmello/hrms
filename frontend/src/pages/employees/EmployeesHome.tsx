import { can } from "../../utils/permissions";
import EmployeeManagement from "./EmployeeManagement";
import EmployeeDirectoryPage from "./EmployeeDirectoryPage";

// One address (/employees) for everyone who can see employees. What they
// see follows their permissions: HR / Admin get the full management page,
// a manager gets their team.
export default function EmployeesHome() {
  return can("employee.view_all") ? (
    <EmployeeManagement />
  ) : (
    <EmployeeDirectoryPage />
  );
}
