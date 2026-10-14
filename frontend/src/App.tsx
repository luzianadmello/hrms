import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/auth/Login";
import ChangePassword from "./pages/auth/ChangePassword";
import CompleteProfile from "./pages/auth/CompleteProfile";

import ProtectedRoute from "./components/auth/ProtectedRoute";

import Dashboard from "./pages/Dashboard";
import EmployeeManagement from "./pages/employees/EmployeeManagement";
import EmployeeDirectoryPage from "./pages/employees/EmployeeDirectoryPage";
import CreateEmployee from "./pages/employees/CreateEmployee";
import ProfilePage from "./pages/profile/ProfilePage";

// Permission names come from the database (role_permissions).
// Keep these at module level so they are stable between renders.
const CAN_CREATE_USERS = "user.create";
const CAN_VIEW_EMPLOYEES = ["employee.view_all", "employee.view_team"];

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

        {/* Dedicated Employee Management landing page for HR / Admin */}
        <Route
          path="/employees"
          element={
            <ProtectedRoute requiredPermission={CAN_CREATE_USERS}>
              <EmployeeManagement />
            </ProtectedRoute>
          }
        />

        {/* Employee Directory for HR / Admin / Manager */}
        <Route
          path="/employees/directory"
          element={
            <ProtectedRoute requiredPermission={CAN_VIEW_EMPLOYEES}>
              <EmployeeDirectoryPage />
            </ProtectedRoute>
          }
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

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;