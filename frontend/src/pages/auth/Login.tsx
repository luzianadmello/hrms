import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import {
  EmailOutlined,
  LockOutlined,
  VisibilityOffOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import api from "../../services/api";
import { setSession } from "../../utils/auth";
import { getErrorMessage } from "../../utils/errors";

const FONT = "'Montserrat', sans-serif";

const INK = "#16181D";
const TEAL = "#16181D";
const MUTED = "#6B6F76";
const BORDER = "#DAD7CF";

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    height: 50,
    borderRadius: "10px",
    backgroundColor: "#FFFFFF",
    fontFamily: FONT,
    fontSize: "14px",
    fontWeight: 500,
    color: INK,

    "& fieldset": {
      border: `1px solid ${BORDER}`,
    },

    "&:hover fieldset": {
      borderColor: "#A9A69D",
    },

    "&.Mui-focused fieldset": {
      borderColor: TEAL,
      borderWidth: "1.5px",
    },
  },

  "& input::placeholder": {
    color: "#9A9CA2",
    opacity: 1,
  },

  "& .MuiInputAdornment-root svg": {
    color: "#8A8D93",
    fontSize: 20,
  },

  "& .Mui-focused .MuiInputAdornment-root svg": {
    color: TEAL,
  },
};

const labelSx = {
  fontFamily: FONT,
  fontSize: "13px",
  fontWeight: 600,
  color: INK,
  mb: 1,
};

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      const {
        access_token,
        must_change_password,
        profile_completed,
        role_id,
      } = response.data;

      // Token + role (role is only used for UI decisions; the server
      // enforces permissions)
      setSession(access_token, role_id);

      /*
       * LOGIN ROUTING
       *
       *   must change password -> Change Password
       *   profile not completed -> Complete Profile
       *   otherwise             -> Dashboard
       */
      if (must_change_password === true) {
        navigate("/change-password", { replace: true });
      } else if (profile_completed === false) {
        navigate("/complete-profile", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && !err.response) {
        setError(
          "Can't reach the server. Check your connection and try again."
        );
      } else {
        setError(getErrorMessage(err, "Incorrect email or password."));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 4,
        fontFamily: FONT,
        backgroundColor: "#F5F4F0",

        "&::before, &::after": {
          content: '""',
          position: "absolute",
          borderRadius: "50%",
          filter: "blur(90px)",
          pointerEvents: "none",
        },

        "&::before": {
          width: 460,
          height: 460,
          top: -140,
          left: -120,
          background:
            "rgba(22,24,29,0.20)",
        },

        "&::after": {
          width: 420,
          height: 420,
          bottom: -140,
          right: -100,
          background:
            "rgba(214,190,150,0.45)",
        },
      }}
    >
      {/* Card */}

      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 440,
          backgroundColor: "#FFFFFF",
          border: `1px solid ${BORDER}`,
          borderRadius: "20px",
          px: {
            xs: 3,
            sm: 5,
          },
          pt: {
            xs: 4,
            sm: 5,
          },
          pb: {
            xs: 3,
            sm: 4,
          },

          "@keyframes cardIn": {
            from: {
              opacity: 0,
              transform: "translateY(12px)",
            },

            to: {
              opacity: 1,
              transform: "translateY(0)",
            },
          },

          animation:
            "cardIn .5s ease-out both",

          "@media (prefers-reduced-motion: reduce)":
            {
              animation: "none",
            },
        }}
      >
        {/* Titles */}

        <Box
          sx={{
            textAlign: "center",
            mb: 4,
          }}
        >
          <Typography
            component="h1"
            sx={{
              fontFamily: FONT,
              fontSize: {
                xs: "24px",
                sm: "28px",
              },
              fontWeight: 700,
              letterSpacing: "-0.6px",
              lineHeight: 1.2,
              color: INK,
              mb: 1,
            }}
          >
            Welcome back
          </Typography>

          <Typography
            sx={{
              fontFamily: FONT,
              fontSize: "14px",
              fontWeight: 400,
              color: MUTED,
            }}
          >
            Sign in to your HRMS account
          </Typography>
        </Box>

        {/* Error */}

        {error && (
          <Alert
            severity="error"
            role="alert"
            sx={{
              mb: 2.5,
              borderRadius: "10px",
              fontFamily: FONT,
              fontSize: "13px",
              alignItems: "center",
            }}
          >
            {error}
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={handleSubmit}
        >
          {/* Email */}

          <Typography
            component="label"
            htmlFor="email"
            sx={{
              ...labelSx,
              display: "block",
            }}
          >
            Email
          </Typography>

          <TextField
            id="email"
            fullWidth
            required
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            autoComplete="email"
            autoFocus
            disabled={loading}
            sx={{
              ...fieldSx,
              mb: 2.5,
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailOutlined />
                  </InputAdornment>
                ),
              },
            }}
          />

          {/* Password */}

          <Typography
            component="label"
            htmlFor="password"
            sx={{
              ...labelSx,
              display: "block",
            }}
          >
            Password
          </Typography>

          <TextField
            id="password"
            fullWidth
            required
            type={
              showPassword
                ? "text"
                : "password"
            }
            placeholder="Enter your password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            autoComplete="current-password"
            disabled={loading}
            sx={{
              ...fieldSx,
              mb: 3.5,
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined />
                  </InputAdornment>
                ),

                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      edge="end"
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                      onClick={() =>
                        setShowPassword(
                          (s) => !s
                        )
                      }
                      onMouseDown={(e) =>
                        e.preventDefault()
                      }
                      disabled={loading}
                    >
                      {showPassword ? (
                        <VisibilityOffOutlined />
                      ) : (
                        <VisibilityOutlined />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          {/* Submit */}

          <Button
            type="submit"
            fullWidth
            disableElevation
            disabled={
              loading ||
              !email ||
              !password
            }
            sx={{
              height: 50,
              borderRadius: "10px",
              textTransform: "none",
              fontFamily: FONT,
              fontSize: "14px",
              fontWeight: 600,
              color: "#FFFFFF",
              backgroundColor: INK,
              boxShadow: "none",

              "&:hover": {
                backgroundColor: "#2B2F38",
                boxShadow: "none",
              },

              "&:active": {
                boxShadow: "none",
              },

              "&:focus-visible": {
                outline:
                  "3px solid rgba(22,24,29,0.45)",
                outlineOffset: "2px",
              },

              "&.Mui-disabled": {
                backgroundColor: "#D9D7D0",
                color: "#FFFFFF",
              },
            }}
          >
            {loading ? (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.2,
                }}
              >
                <CircularProgress
                  size={16}
                  thickness={5}
                  sx={{
                    color: "#FFFFFF",
                  }}
                />

                Signing in
              </Box>
            ) : (
              "Sign in"
            )}
          </Button>
        </Box>

        {/* Footer */}

        <Typography
          sx={{
            mt: 4,
            textAlign: "center",
            fontFamily: FONT,
            fontSize: "12px",
            fontWeight: 500,
            color: "#9A9CA2",
          }}
        >
          HRMS © 2026
        </Typography>
      </Box>
    </Box>
  );
}

export default Login;