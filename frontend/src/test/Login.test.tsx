
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "../pages/auth/Login";
import api from "../services/api";
import { getErrorMessage } from "../utils/errors";

vi.mock("../services/api", () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock("../utils/errors", () => ({
  getErrorMessage: vi.fn(),
}));

describe("Login page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AUTH-63: Login page rendering
  it("renders email, password and login button", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
  });

  // AUTH-64: Empty email validation
  it("shows an error when email is empty and does not call login API", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText("Password"), "ValidPassword123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  // AUTH-65: Empty password validation
  it("shows an error when password is empty and does not call login API", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText("Email"), "test@company.com");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Password is required")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  // AUTH-66: Valid login with trimmed values
  it("calls the login service once with trimmed email and password values", async () => {
    const user = userEvent.setup();

    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        must_change_password: false,
        profile_completed: true,
      },
    } as never);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText("Email"), "TEST@company.com");
    await user.type(screen.getByLabelText("Password"), "ValidPassword123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith("/auth/login", {
      email: "test@company.com",
      password: "ValidPassword123",
    });
  });

  // AUTH-67: Server error on 401
  it("shows the server error when login returns 401", async () => {
    const user = userEvent.setup();

    vi.mocked(api.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 401,
        data: {
          detail: "Invalid email or password",
        },
      },
    });

    vi.mocked(getErrorMessage).mockReturnValueOnce(
      "Invalid email or password"
    );

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText("Email"), "test@company.com");
    await user.type(screen.getByLabelText("Password"), "WrongPassword123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password"
    );

    expect(api.post).toHaveBeenCalledTimes(1);
  });
});
