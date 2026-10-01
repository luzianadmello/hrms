import { useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  CssBaseline,
  FormControlLabel,
  Grid,
  Link,
  Paper,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import api from "../services/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", {
        email: email,
        password: password,
      });

      console.log("Login successful:", response.data);

      // JWT received from backend
      const token = response.data.access_token;

      // Temporarily store token
      localStorage.setItem("access_token", token);

      console.log("Token saved successfully");

    } catch (error: any) {
      console.error("Login failed:", error);

      if (error.response) {
        setError(
          error.response.data?.detail ||
            "Invalid email or password"
        );
      } else {
        setError(
          "Unable to connect to the server. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Grid
      container
      component="main"
      sx={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
      }}
    >
      <CssBaseline />

      {/* Left Side */}
      <Grid
        size={{ xs: false, sm: 4, md: 7 }}
        sx={{
          display: { xs: "none", sm: "block" },
          backgroundColor: "#1976d2",
        }}
      >
        <Box
          sx={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            textAlign: "center",
            p: 4,
          }}
        >
          <Box>
            <Typography
              variant="h2"
              sx={{ fontWeight: "bold" }}
            >
              HRMS
            </Typography>

            <Typography
              variant="h5"
              sx={{ mt: 2 }}
            >
              Human Resource Management System
            </Typography>

            <Typography
              sx={{
                mt: 2,
                opacity: 0.9,
              }}
            >
              Manage your workforce with ease.
            </Typography>
          </Box>
        </Box>
      </Grid>

      {/* Login Section */}
      <Grid
        size={{ xs: 12, sm: 8, md: 5 }}
        component={Paper}
        elevation={6}
        square
      >
        <Box
          sx={{
            my: 8,
            mx: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Avatar
            sx={{
              m: 1,
              bgcolor: "primary.main",
            }}
          >
            <LockOutlinedIcon />
          </Avatar>

          <Typography
            component="h1"
            variant="h5"
          >
            Sign in
          </Typography>

          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              mt: 3,
              width: "100%",
            }}
          >
            {/* Error Message */}
            {error && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
              >
                {error}
              </Alert>
            )}

            {/* Email */}
            <TextField
              margin="normal"
              required
              fullWidth
              label="Email Address"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
            />

            {/* Password */}
            <TextField
              margin="normal"
              required
              fullWidth
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
            />

            <FormControlLabel
              control={
                <Checkbox
                  value="remember"
                  color="primary"
                />
              }
              label="Remember me"
            />

            {/* Login Button */}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{
                mt: 2,
                mb: 2,
                py: 1.2,
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <Grid container>
              <Grid size={12}>
                <Link
                  href="#"
                  variant="body2"
                >
                  Forgot password?
                </Link>
              </Grid>
            </Grid>

            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
              sx={{ mt: 5 }}
            >
              © HRMS 2026
            </Typography>
          </Box>
        </Box>
      </Grid>
    </Grid>
  );
}

export default Login;