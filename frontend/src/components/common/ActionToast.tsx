import { Alert, Snackbar, type AlertColor } from "@mui/material";
import { useThemeMode } from "../../contexts/ThemeModeContext";

interface ActionToastProps {
  open: boolean;
  severity: AlertColor;
  message: string;
  onClose: () => void;
}

const COLOR_MAP: Record<AlertColor, { bgDark: string; bgLight: string; text: string; borderDark: string; borderLight: string }> = {
  success: {
    bgDark: "#065F46",
    bgLight: "#10B981",
    text: "#FFFFFF",
    borderDark: "rgba(52, 211, 153, 0.4)",
    borderLight: "rgba(16, 185, 129, 0.3)",
  },
  error: {
    bgDark: "#991B1B",
    bgLight: "#EF4444",
    text: "#FFFFFF",
    borderDark: "rgba(248, 113, 113, 0.4)",
    borderLight: "rgba(239, 68, 68, 0.3)",
  },
  warning: {
    bgDark: "#92400E",
    bgLight: "#F59E0B",
    text: "#FFFFFF",
    borderDark: "rgba(251, 191, 36, 0.4)",
    borderLight: "rgba(245, 158, 11, 0.3)",
  },
  info: {
    bgDark: "#1E40AF",
    bgLight: "#3B82F6",
    text: "#FFFFFF",
    borderDark: "rgba(96, 165, 250, 0.4)",
    borderLight: "rgba(59, 130, 246, 0.3)",
  },
};

export default function ActionToast({
  open,
  severity,
  message,
  onClose,
}: ActionToastProps) {
  const { mode } = useThemeMode();
  const isDark = mode === "dark";
  const colors = COLOR_MAP[severity] ?? COLOR_MAP.info;

  return (
    <Snackbar
      open={open}
      autoHideDuration={4000}
      onClose={(_, reason) => {
        if (reason !== "clickaway") onClose();
      }}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      sx={{ zIndex: (theme) => theme.zIndex.tooltip + 1, mt: 1 }}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        variant="filled"
        sx={{
          width: "100%",
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 600,
          fontSize: "13px",
          borderRadius: "12px",
          backgroundColor: `${isDark ? colors.bgDark : colors.bgLight} !important`,
          color: `${colors.text} !important`,
          border: `1px solid ${isDark ? colors.borderDark : colors.borderLight}`,
          boxShadow: isDark
            ? "0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)"
            : "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
          "& .MuiAlert-icon": {
            color: `${colors.text} !important`,
          },
          "& .MuiAlert-action": {
            color: `${colors.text} !important`,
          },
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
