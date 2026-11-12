import { Box, Chip } from "@mui/material";
import { useThemeMode } from "../../contexts/ThemeModeContext";

const FONT = "'Montserrat', sans-serif";

interface StatusChipProps {
  status: string;
  onClick?: () => void;
}

/** One place that decides how an employee/record status looks across the entire app. */
export default function StatusChip({ status, onClick }: StatusChipProps) {
  const { mode } = useThemeMode();
  const isDark = mode === "dark";
  const norm = (status || "").toUpperCase();
  const isActive = norm === "ACTIVE";
  const isInactive = norm === "INACTIVE";

  let bg = isDark ? "rgba(255,255,255,0.06)" : "#F0EFEB";
  let color = isDark ? "#A0A4AC" : "#6B6F76";
  let border = isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #DAD7CF";
  let dotColor = color;
  let label = status || "Unknown";

  if (isActive) {
    label = "Active";
    bg = isDark ? "rgba(16, 185, 129, 0.16)" : "rgba(16, 185, 129, 0.10)";
    color = isDark ? "#34D399" : "#059669";
    border = isDark ? "1px solid rgba(52, 211, 153, 0.35)" : "1px solid rgba(16, 185, 129, 0.25)";
    dotColor = isDark ? "#34D399" : "#10B981";
  } else if (isInactive) {
    label = "Inactive";
    bg = isDark ? "rgba(239, 68, 68, 0.16)" : "rgba(239, 68, 68, 0.10)";
    color = isDark ? "#F87171" : "#DC2626";
    border = isDark ? "1px solid rgba(248, 113, 113, 0.35)" : "1px solid rgba(239, 68, 68, 0.25)";
    dotColor = isDark ? "#F87171" : "#EF4444";
  }

  return (
    <Chip
      size="small"
      icon={
        <Box
          component="span"
          sx={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            backgroundColor: `${dotColor} !important`,
            boxShadow: isActive ? `0 0 6px ${dotColor}` : "none",
            ml: "6px !important",
            mr: "-4px !important",
          }}
        />
      }
      label={label}
      onClick={onClick}
      sx={{
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: "11px",
        borderRadius: "8px",
        height: 24,
        cursor: onClick ? "pointer" : "default",
        backgroundColor: `${bg} !important`,
        color: `${color} !important`,
        border,
        transition: "all 0.15s ease-in-out",
        "& .MuiChip-label": {
          px: 1,
          color: `${color} !important`,
        },
        "&:hover": onClick
          ? {
              backgroundColor: isActive
                ? (isDark ? "rgba(16, 185, 129, 0.26) !important" : "rgba(16, 185, 129, 0.18) !important")
                : (isDark ? "rgba(239, 68, 68, 0.26) !important" : "rgba(239, 68, 68, 0.18) !important"),
              transform: "scale(1.02)",
            }
          : undefined,
      }}
    />
  );
}
