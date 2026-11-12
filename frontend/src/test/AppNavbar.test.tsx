// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import AppNavbar from "../components/layout/AppNavbar";
import api from "../services/api";

vi.mock("../services/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

function LocationDisplay() {
  const location = useLocation();

  return <div data-testid="current-location">{location.pathname}</div>;
}

describe("AppNavbar Logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    vi.mocked(api.get).mockResolvedValue({
      data: {
        permissions: ["employee.view_all"],
        role_name: "HR",
        must_change_password: false,
        profile_completed: true,
      },
    });

    vi.mocked(api.post).mockResolvedValue({
      data: {
        message: "Logged out successfully",
      },
    });
  });

  // AUTH-78
  it("calls logout service, clears session and redirects to login", async () => {
    const user = userEvent.setup();

    localStorage.setItem("role_id", "1");

    render(
      <MemoryRouter initialEntries={["/employees"]}>
        <AppNavbar pageTitle={""} />
        <LocationDisplay />
      </MemoryRouter>
    );

    const accountButton = await screen.findByRole("button", {
      name: /account settings/i,
    });

    await user.click(accountButton);

    const logoutButton = await screen.findByRole("menuitem", {
      name: /logout/i,
    });

    await user.click(logoutButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/auth/logout");
    });

    await waitFor(() => {
      expect(localStorage.getItem("role_id")).toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByTestId("current-location")).toHaveTextContent(
        "/login"
      );
    });
  });
});