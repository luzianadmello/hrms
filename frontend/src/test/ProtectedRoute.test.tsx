// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import api from "../services/api";

vi.mock("../services/api", () => ({
  default: {
    get: vi.fn(),
  },
}));

function LocationDisplay() {
  const location = useLocation();

  return <div data-testid="current-location">{location.pathname}</div>;
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AUTH-73
  it("redirects anonymous users to login when authentication returns 401", async () => {
    vi.mocked(api.get).mockRejectedValue({
      response: {
        status: 401,
      },
    });

    render(
      <MemoryRouter initialEntries={["/employees"]}>
        <Routes>
          <Route
            path="/employees"
            element={
              <ProtectedRoute>
                <div>Employees Page</div>
              </ProtectedRoute>
            }
          />

          <Route
            path="/login"
            element={
              <>
                <div>Login Page</div>
                <LocationDisplay />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Login Page")).toBeInTheDocument();

    expect(screen.getByTestId("current-location")).toHaveTextContent(
      "/login"
    );

    expect(api.get).toHaveBeenCalledWith("/auth/me");
  });

  // AUTH-74
  it("renders protected page for an authenticated user", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        permissions: ["employee.view_all"],
        role_name: "HR",
        must_change_password: false,
        profile_completed: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/employees"]}>
        <Routes>
          <Route
            path="/employees"
            element={
              <ProtectedRoute>
                <div>Employees Page</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Employees Page")).toBeInTheDocument();

    expect(api.get).toHaveBeenCalledWith("/auth/me");
  });
});