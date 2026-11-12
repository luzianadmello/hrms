import type { ReactNode } from "react";
import {
  Avatar,
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Typography,
} from "@mui/material";
import {
  BadgeOutlined,
  BusinessOutlined,
  CalendarMonthOutlined,
  CheckCircleRounded,
  CloseRounded,
  EmailOutlined,
  HourglassEmptyRounded,
  LocationOnOutlined,
  PhoneOutlined,
  WorkOutlineRounded,
} from "@mui/icons-material";
import type { EmployeeDetail } from "../../types/employee";

import { useNavigate } from "react-router-dom";
import { EditOutlined } from "@mui/icons-material";
import StatusChip from "./StatusChip";
import { Button } from "@mui/material";
import { useThemeMode } from "../../contexts/ThemeModeContext";

const FONT = "'Montserrat', sans-serif";

interface EmployeeProfileModalProps {
  open: boolean;
  employee: EmployeeDetail | null;
  onClose: () => void;
  onSaved?: () => void;
  canEdit?: boolean;
}

interface DetailRowProps {
  icon: ReactNode;
  label: string;
  value: string | null | undefined;
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, py: 1 }}>
      <Box sx={{ color: "var(--hrms-muted)", display: "flex", alignItems: "center", mt: "2px", "& svg": { fontSize: 19 } }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontFamily: FONT, fontSize: "11px", fontWeight: 600, color: "var(--hrms-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {label}
        </Typography>
        <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 500, color: "var(--hrms-text)", mt: "2px", wordBreak: "break-word" }}>
          {value || "—"}
        </Typography>
      </Box>
    </Box>
  );
}

export default function EmployeeProfileModal({
  open,
  employee,
  onClose,
  canEdit = true,
}: EmployeeProfileModalProps) {
  const navigate = useNavigate();
  const { mode } = useThemeMode();
  const isDark = mode === "dark";
  if (!employee) return null;

  const fullName = `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || "Employee";
  const initials = `${(employee.first_name?.[0] || "").toUpperCase()}${(employee.last_name?.[0] || "").toUpperCase()}` || "EM";

  const fullAddress = [
    employee.address_line1,
    employee.address_line2,
    employee.city,
    employee.state,
    employee.country ? `${employee.country} - ${employee.pincode || ""}` : employee.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "20px",
            border: "1px solid var(--hrms-border)",
            backgroundColor: "var(--hrms-surface)",
            color: "var(--hrms-text)",
            p: { xs: 1, sm: 2 },
            boxShadow: isDark ? "0 20px 60px rgba(0,0,0,0.5)" : "0 20px 60px rgba(0,0,0,0.15)",
            backgroundImage: "none",
          },
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1, backgroundColor: "var(--hrms-surface)", color: "var(--hrms-text)" }}>
        <Typography sx={{ fontFamily: FONT, fontSize: "13px", fontWeight: 600, color: "var(--hrms-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          Employee Profile
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: "var(--hrms-muted)", "&:hover": { backgroundColor: "var(--hrms-hover)", color: "var(--hrms-text)" } }}>
          <CloseRounded />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, pb: 3, backgroundColor: "var(--hrms-surface)", color: "var(--hrms-text)" }}>
        {/* Profile Header Card */}
        <Box
          sx={{
            p: 3,
            borderRadius: "16px",
            backgroundColor: "var(--hrms-surface-alt)",
            border: "1px solid var(--hrms-border)",
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "flex-start", sm: "center" },
            gap: 2.5,
            mb: 3,
          }}
        >
          <Avatar
            sx={{
              width: 68,
              height: 68,
              bgcolor: isDark ? "var(--hrms-border)" : "var(--hrms-text)",
              color: isDark ? "var(--hrms-text)" : "#FFFFFF",
              fontFamily: FONT,
              fontSize: "22px",
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
            }}
          >
            {initials}
          </Avatar>

          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.2, mb: 0.6 }}>
              <Typography sx={{ fontFamily: FONT, fontSize: "22px", fontWeight: 700, color: "var(--hrms-text)", letterSpacing: "-0.5px" }}>
                {fullName}
              </Typography>
              <Chip label={employee.employee_code} size="small" sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "11px", backgroundColor: "var(--hrms-hover)", color: "var(--hrms-text)", borderRadius: "6px", border: "1px solid var(--hrms-border)" }} />
              <StatusChip status={employee.status} />
            </Box>
            <Typography sx={{ fontFamily: FONT, fontSize: "14px", color: "var(--hrms-muted)" }}>
              {employee.designation_name || "Designation not set"} • {employee.department_name || "Department not set"}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {employee.profile_completed ? (
              <Chip
                icon={<CheckCircleRounded sx={{ fontSize: "15px !important", color: isDark ? "#34D399 !important" : "#059669 !important" }} />}
                label="Profile Completed"
                size="small"
                sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "11px", backgroundColor: isDark ? "rgba(16,185,129,0.16)" : "rgba(16,185,129,0.10)", color: isDark ? "#34D399 !important" : "#059669 !important", border: isDark ? "1px solid rgba(52,211,153,0.35)" : "1px solid rgba(16,185,129,0.25)" }}
              />
            ) : (
              <Chip
                icon={<HourglassEmptyRounded sx={{ fontSize: "15px !important", color: isDark ? "#FBBF24 !important" : "#D97706 !important" }} />}
                label="Profile Incomplete"
                size="small"
                sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "11px", backgroundColor: isDark ? "rgba(251,191,36,0.16)" : "rgba(251,191,36,0.10)", color: isDark ? "#FBBF24 !important" : "#D97706 !important", border: isDark ? "1px solid rgba(251,191,36,0.35)" : "1px solid rgba(251,191,36,0.25)" }}
              />
            )}
          </Box>
        </Box>

        {/* 2-Column Details */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
          {/* Employment Details */}
          <Box sx={{ p: 2.5, borderRadius: "14px", border: "1px solid var(--hrms-border)", backgroundColor: "var(--hrms-surface)" }}>
            <Typography sx={{ fontFamily: FONT, fontSize: "15px", fontWeight: 700, color: "var(--hrms-text)", mb: 1.5 }}>
              Employment Information
            </Typography>
            <Divider sx={{ mb: 1.5, borderColor: "var(--hrms-border-subtle)" }} />
            <DetailRow icon={<WorkOutlineRounded />} label="Assigned Role" value={employee.role_name || "Employee"} />
            <DetailRow icon={<BusinessOutlined />} label="Department" value={employee.department_name} />
            <DetailRow icon={<BadgeOutlined />} label="Designation" value={employee.designation_name} />
            <DetailRow icon={<CalendarMonthOutlined />} label="Date of Joining" value={employee.date_of_joining} />
            <DetailRow icon={<WorkOutlineRounded />} label="Employment Type" value={employee.employment_type?.replace("_", " ")} />
            <DetailRow icon={<BadgeOutlined />} label="Reporting Manager" value={employee.manager_name || "None"} />
          </Box>

          {/* Personal & Contact Details */}
          <Box sx={{ p: 2.5, borderRadius: "14px", border: "1px solid var(--hrms-border)", backgroundColor: "var(--hrms-surface)" }}>
            <Typography sx={{ fontFamily: FONT, fontSize: "15px", fontWeight: 700, color: "var(--hrms-text)", mb: 1.5 }}>
              Personal & Contact Details
            </Typography>
            <Divider sx={{ mb: 1.5, borderColor: "var(--hrms-border-subtle)" }} />
            <DetailRow icon={<EmailOutlined />} label="Official Email" value={employee.email} />
            <DetailRow icon={<PhoneOutlined />} label="Phone Number" value={employee.phone} />
            <DetailRow icon={<CalendarMonthOutlined />} label="Date of Birth" value={employee.dob} />
            <DetailRow icon={<LocationOnOutlined />} label="Residential Address" value={fullAddress || "No address entered yet"} />
          </Box>
        </Box>

        {/* Actions */}
        <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid var(--hrms-border)", display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={onClose}
            sx={{ borderRadius: "10px", borderColor: "var(--hrms-border)", color: "var(--hrms-muted)", textTransform: "none", fontFamily: FONT, fontWeight: 600, fontSize: "13px", "&:hover": { borderColor: "var(--hrms-text)", color: "var(--hrms-text)" } }}
          >
            Close
          </Button>

          {canEdit && (
            <Button
              variant="contained"
              startIcon={<EditOutlined />}
              onClick={() => { onClose(); navigate(`/employees/${employee.employee_id}`); }}
              sx={{ borderRadius: "10px", backgroundColor: "var(--hrms-btn-primary-bg)", color: "var(--hrms-btn-primary-text)", textTransform: "none", fontFamily: FONT, fontSize: "13px", fontWeight: 650, px: 2.5, boxShadow: "none", "&:hover": { backgroundColor: "var(--hrms-btn-primary-hover)", boxShadow: "none" } }}
            >
              Edit Profile
            </Button>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
