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

// Role IDs
const ADMIN_AND_HR = [1, 2];
const STAFF_VIEWERS = [1, 2, 4];

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
            <ProtectedRoute allowedRoles={ADMIN_AND_HR}>
              <EmployeeManagement />
            </ProtectedRoute>
          }
        />

        {/* Employee Directory for HR / Admin / Manager */}
        <Route
          path="/employees/directory"
          element={
            <ProtectedRoute allowedRoles={STAFF_VIEWERS}>
              <EmployeeDirectoryPage />
            </ProtectedRoute>
          }
        />

        {/* Create Employee for HR / Admin */}
        <Route
          path="/employees/create"
          element={
            <ProtectedRoute allowedRoles={ADMIN_AND_HR}>
              <CreateEmployee />
            </ProtectedRoute>
          }
        />

        {/* HR viewing and editing an employee profile */}
        <Route
          path="/employees/:id"
          element={
            <ProtectedRoute allowedRoles={ADMIN_AND_HR}>
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