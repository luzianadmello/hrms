import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/auth/Login";
import ChangePassword from "./pages/auth/ChangePassword";
import CompleteProfile from "./pages/auth/CompleteProfile";

import ProtectedRoute from "./components/auth/ProtectedRoute";

import Dashboard from "./pages/Dashboard";
import EmployeesHome from "./pages/employees/EmployeesHome";
import CreateEmployee from "./pages/employees/CreateEmployee";
import ProfilePage from "./pages/profile/ProfilePage";
import OrganizationManagement from "./pages/organization/OrganizationManagement";
import AttendancePage from "./pages/attendance/AttendancePage";
import LeaveManagementPage from "./pages/leave/LeaveManagementPage";
import HolidayManagementPage from "./pages/holidays/HolidayManagementPage";

// Permission names come from the database (role_permissions).
// Keep these at module level so they are stable between renders.
const CAN_CREATE_USERS = "user.create";
const CAN_VIEW_EMPLOYEES = ["employee.view_all", "employee.view_team"];
const CAN_VIEW_DEPARTMENTS = "department.view";
const CAN_VIEW_DESIGNATIONS = "designation.view";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login />} />

        <Route
          path="/change-password"
          element={
            <ProtectedRoute stage="password">
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        <Route
          path="/complete-profile"
          element={
            <ProtectedRoute stage="profile">
              <CompleteProfile />
            </ProtectedRoute>
          }
        />

        {/* Dashboard for all roles (role-aware rendering) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Employees: HR / Admin see everyone, a manager sees their team */}
        <Route
          path="/employees"
          element={
            <ProtectedRoute requiredPermission={CAN_VIEW_EMPLOYEES}>
              <EmployeesHome />
            </ProtectedRoute>
          }
        />

        {/* The old directory address now points at the same page */}
        <Route
          path="/employees/directory"
          element={<Navigate to="/employees" replace />}
        />

        {/* Create Employee for HR / Admin */}
        <Route
          path="/employees/create"
          element={
            <ProtectedRoute requiredPermission={CAN_CREATE_USERS}>
              <CreateEmployee />
            </ProtectedRoute>
          }
        />

        {/* HR viewing and editing an employee profile */}
        <Route
          path="/employees/:id"
          element={
            <ProtectedRoute requiredPermission={CAN_VIEW_EMPLOYEES}>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Employee viewing and editing their own profile */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Attendance submodules live in the sidebar dropdown, not a second navbar. */}
        <Route path="/attendance" element={<Navigate to="/attendance/my-attendance" replace />} />
        { ["my-attendance", "employees", "reports", "settings"].map((subpath) => (
          <Route
            key={subpath}
            path={`/attendance/${subpath}`}
            element={
              <ProtectedRoute requiredPermission={["attendance.view_own", "attendance.view_all", "attendance.view_policy"]}>
                <AttendancePage />
              </ProtectedRoute>
            }
          />
        )) }

        {/* Leave management: requests, balances and leave-type administration */}
        <Route
          path="/leave"
          element={
            <ProtectedRoute requiredPermission={[
              "leave_request.view_own", "leave_request.view_team", "leave_request.view_all",
              "leave_balance.view_own", "leave_balance.view_all", "leave_type.view",
            ]}>
              <LeaveManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Company holiday calendar */}
        <Route
          path="/holidays"
          element={
            <ProtectedRoute requiredPermission="holiday.view">
              <HolidayManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Organization Management: departments and designations */}
        <Route
          path="/organization"
          element={<Navigate to="/organization/departments" replace />}
        />

        <Route
          path="/organization/departments"
          element={
            <ProtectedRoute requiredPermission={CAN_VIEW_DEPARTMENTS}>
              <OrganizationManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organization/designations"
          element={
            <ProtectedRoute requiredPermission={CAN_VIEW_DESIGNATIONS}>
              <OrganizationManagement />
            </ProtectedRoute>
          }
        />

        {/* Unknown URLs go to the dashboard (which is protected, so logged-out
            users still end up at /login) instead of looking like a logout. */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
