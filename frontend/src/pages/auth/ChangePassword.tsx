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
  CheckCircleOutlined,
  LockOutlined,
  VisibilityOffOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

import api from "../../services/api";
import { setSession } from "../../utils/auth";
import { logout } from "../../services/session";
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
  display: "block",
  fontFamily: FONT,
  fontSize: "13px",
  fontWeight: 600,
  color: INK,
  marginBottom: "8px",
};

function ChangePassword() {
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const passwordLongEnough = newPassword.length >= 8;

  const passwordsMatch =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/change-password", {
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      // The old token is revoked by the server when the password changes,
      // so keep the fresh one it just sent back.
      setSession(response.data.access_token, response.data.role_id);

      // Everyone with an employee record completes their profile next.
      // (Accounts without one, like the Admin, are already marked complete.)
      navigate(
        response.data.profile_completed ? "/dashboard" : "/complete-profile",
        { replace: true }
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to change your password."));
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
        backgroundColor: "#F5F4F0",
        fontFamily: FONT,

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
          background: "rgba(22,24,29,0.20)",
        },

        "&::after": {
          width: 420,
          height: 420,
          bottom: -140,
          right: -100,
          background: "rgba(214,190,150,0.45)",
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 460,
          backgroundColor: "#FFFFFF",
          border: `1px solid ${BORDER}`,
          borderRadius: "20px",
          px: { xs: 3, sm: 5 },
          pt: { xs: 4, sm: 5 },
          pb: { xs: 3, sm: 4 },

          "@keyframes cardIn": {
            from: { opacity: 0, transform: "translateY(12px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },

          animation: "cardIn .5s ease-out both",
        }}
      >
        <Box
          sx={{
            width: 46,
            height: 46,
            borderRadius: "12px",
            backgroundColor: "rgba(22,24,29,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mx: "auto",
            mb: 2,
          }}
        >
          <LockOutlined sx={{ color: TEAL, fontSize: 22 }} />
        </Box>

        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Typography
            component="h1"
            sx={{
              fontFamily: FONT,
              fontSize: { xs: "24px", sm: "28px" },
              fontWeight: 700,
              letterSpacing: "-0.6px",
              lineHeight: 1.2,
              color: INK,
              mb: 1,
            }}
          >
            Create your password
          </Typography>

          <Typography
            sx={{
              fontFamily: FONT,
              fontSize: "14px",
              lineHeight: 1.6,
              color: MUTED,
            }}
          >
            For security, please create a new password before continuing.
          </Typography>
        </Box>

        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 2.5,
              borderRadius: "10px",
              fontFamily: FONT,
              fontSize: "13px",
            }}
          >
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Typography component="label" htmlFor="new-password" sx={labelSx}>
            New Password
          </Typography>

          <TextField
            id="new-password"
            fullWidth
            required
            type={showPassword ? "text" : "password"}
            placeholder="Enter your new password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={loading}
            autoComplete="new-password"
            sx={{ ...fieldSx, mb: 1.5 }}
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
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((value) => !value)}
                      onMouseDown={(event) => event.preventDefault()}
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

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.8,
              mb: 2.5,
            }}
          >
            <CheckCircleOutlined
              sx={{
                fontSize: 15,
                color: passwordLongEnough ? TEAL : "#B2B3B6",
              }}
            />

            <Typography
              sx={{ fontFamily: FONT, fontSize: "12px", color: MUTED }}
            >
              At least 8 characters
            </Typography>
          </Box>

          <Typography
            component="label"
            htmlFor="confirm-password"
            sx={labelSx}
          >
            Confirm Password
          </Typography>

          <TextField
            id="confirm-password"
            fullWidth
            required
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={loading}
            autoComplete="new-password"
            sx={{ ...fieldSx, mb: 1 }}
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
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      onMouseDown={(event) => event.preventDefault()}
                      disabled={loading}
                    >
                      {showConfirmPassword ? (
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

          {confirmPassword.length > 0 ? (
            <Typography
              sx={{
                fontFamily: FONT,
                fontSize: "12px",
                color: passwordsMatch ? TEAL : "#C24141",
                mt: 0.5,
                mb: 2.5,
              }}
            >
              {passwordsMatch ? "Passwords match" : "Passwords do not match"}
            </Typography>
          ) : (
            <Box sx={{ mb: 2.5 }} />
          )}

          <Button
            type="submit"
            fullWidth
            disableElevation
            disabled={loading || !newPassword || !confirmPassword}
            sx={{
              height: 50,
              borderRadius: "10px",
              textTransform: "none",
              fontFamily: FONT,
              fontSize: "14px",
              fontWeight: 600,
              color: "#FFFFFF",
              backgroundColor: INK,

              "&:hover": { backgroundColor: "#2B2F38" },

              "&.Mui-disabled": {
                backgroundColor: "#D9D7D0",
                color: "#FFFFFF",
              },
            }}
          >
            {loading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                <CircularProgress
                  size={16}
                  thickness={5}
                  sx={{ color: "#FFFFFF" }}
                />
                Updating
              </Box>
            ) : (
              "Continue"
            )}
          </Button>
        </Box>

        <Box sx={{ mt: 3, textAlign: "center" }}>
          <Button
            onClick={handleSignOut}
            disabled={loading}
            sx={{
              textTransform: "none",
              fontFamily: FONT,
              fontSize: "13px",
              fontWeight: 600,
              color: MUTED,

              "&:hover": { backgroundColor: "rgba(22,24,29,0.06)" },
            }}
          >
            Sign out
          </Button>
        </Box>

        <Typography
          sx={{
            mt: 2,
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

export default ChangePassword;