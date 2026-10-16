import { Chip } from "@mui/material";

const FONT = "'Montserrat', sans-serif";

const STATUS_STYLES: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  ACTIVE: { label: "Active", bg: "rgba(16,185,129,0.12)", color: "#059669" },
  INACTIVE: {
    label: "Inactive",
    bg: "rgba(239,68,68,0.12)",
    color: "#DC2626",
  },
};

interface StatusChipProps {
  status: string;
  onClick?: () => void;
}

/** One place that decides how an employee status looks. */
export default function StatusChip({ status, onClick }: StatusChipProps) {
  const style = STATUS_STYLES[status] ?? {
    label: status,
    bg: "#F0EFEB",
    color: "#6B6F76",
  };

  return (
    <Chip
      label={style.label}
      size="small"
      onClick={onClick}
      sx={{
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: "11px",
        borderRadius: "6px",
        cursor: onClick ? "pointer" : "default",
        backgroundColor: style.bg,
        color: style.color,
      }}
    />
  );
}
