import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Box, Button, CircularProgress, Typography } from "@mui/material";

import api from "../../services/api";
import { setRoleId } from "../../utils/auth";
import { setPermissions } from "../../utils/permissions";

/**
 * Which step of the account flow this page belongs to:
 *
 *   "password" -> /change-password   (only while must_change_password)
 *   "profile"  -> /complete-profile  (only while the profile is incomplete)
 *   "app"      -> everything else    (needs both steps done)
 */
type Stage = "password" | "profile" | "app";

type Gate =
  | "ok"
  | "login"
  | "error"
  | "/change-password"
  | "/complete-profile"
  | "/dashboard";

interface ProtectedRouteProps {
  children: ReactNode;
  stage?: Stage;
  requiredPermission?: string | string[];
}

function ProtectedRoute({
  children,
  stage = "app",
  requiredPermission,
}: ProtectedRouteProps) {
  const { pathname } = useLocation();

  // Result is tagged with the path it was computed for, so moving between two
  // protected pages never shows the new page before it has been checked.
  const [result, setResult] = useState<{ key: string; gate: Gate } | null>(
    null
  );
  const [attempt, setAttempt] = useState(0);

  const checkKey = `${pathname}#${attempt}`;

  // Ask the server who this is and where they are in the onboarding flow.
  // The login cookie is sent automatically. If it has expired, the API client
  // silently refreshes it; if that fails too, we get a 401 and go to /login.
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const { data: me } = await api.get("/auth/me");

        if (cancelled) return;

        // The server is the source of truth for the role, not localStorage.
        setRoleId(me.role_id);
        setPermissions(me.permissions ?? [], me.role_name ?? "");

        let gate: Gate = "ok";

        if (me.must_change_password) {
          gate = stage === "password" ? "ok" : "/change-password";
        } else if (stage === "password") {
          gate = "/dashboard";
        } else if (!me.profile_completed) {
          gate = stage === "profile" ? "ok" : "/complete-profile";
        } else if (stage === "profile") {
          gate = "/dashboard";
        } else if (
          requiredPermission &&
          ![requiredPermission]
            .flat()
            .some((p) => (me.permissions ?? []).includes(p))
        ) {
          gate = "/dashboard";
        }

        setResult({ key: checkKey, gate });
      } catch (err: unknown) {
        if (cancelled) return;

        const status = (err as { response?: { status?: number } }).response
          ?.status;

        setResult({ key: checkKey, gate: status === 401 ? "login" : "error" });
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [checkKey, stage, requiredPermission]);

  const gate: Gate | "checking" =
    result && result.key === checkKey ? result.gate : "checking";

  if (gate === "checking") {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F5F4F0",
        }}
      >
        <CircularProgress sx={{ color: "#0F766E" }} />
      </Box>
    );
  }

  if (gate === "error") {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          px: 2,
          backgroundColor: "#F5F4F0",
        }}
      >
        <Typography
          sx={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "14px",
            color: "#6B6F76",
            textAlign: "center",
          }}
        >
          Can't reach the server. Check your connection and try again.
        </Typography>

        <Button
          onClick={() => setAttempt((value) => value + 1)}
          sx={{
            textTransform: "none",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 600,
            color: "#0F766E",
          }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  if (gate === "login") {
    return <Navigate to="/login" replace />;
  }

  if (gate !== "ok") {
    return <Navigate to={gate} replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;