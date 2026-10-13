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

const FONT = "'Montserrat', sans-serif";
const INK = "#16181D";
const TEAL = "#16181D";
const MUTED = "#6B6F76";
const BORDER = "#DAD7CF";

import { useNavigate } from "react-router-dom";
import { EditOutlined } from "@mui/icons-material";
import { Button } from "@mui/material";

interface EmployeeProfileModalProps {
  open: boolean;
  employee: EmployeeDetail | null;
  onClose: () => void;
  onSaved?: () => void;
}

interface DetailRowProps {
  icon: ReactNode;
  label: string;
  value: string | null | undefined;
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, py: 1 }}>
      <Box
        sx={{
          color: TEAL,
          display: "flex",
          alignItems: "center",
          mt: "2px",
          "& svg": { fontSize: 19 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography
          sx={{
            fontFamily: FONT,
            fontSize: "11px",
            fontWeight: 600,
            color: MUTED,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            fontFamily: FONT,
            fontSize: "14px",
            fontWeight: 500,
            color: INK,
            mt: "2px",
            wordBreak: "break-word",
          }}
        >
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
}: EmployeeProfileModalProps) {
  const navigate = useNavigate();
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
            border: `1px solid ${BORDER}`,
            backgroundColor: "#FFFFFF",
            p: { xs: 1, sm: 2 },
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pb: 1,
        }}
      >
        <Typography
          sx={{
            fontFamily: FONT,
            fontSize: "13px",
            fontWeight: 600,
            color: TEAL,
            textTransform: "uppercase",
            letterSpacing: "0.8px",
          }}
        >
          Employee Profile
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: MUTED,
            "&:hover": { backgroundColor: "rgba(22,24,29,0.08)", color: INK },
          }}
        >
          <CloseRounded />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, pb: 3 }}>
        {/* Profile Card Header */}
        <Box
          sx={{
            p: 3,
            borderRadius: "16px",
            backgroundColor: "#FAF9F6",
            border: `1px solid ${BORDER}`,
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
              bgcolor: TEAL,
              color: "#FFFFFF",
              fontFamily: FONT,
              fontSize: "22px",
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(22,24,29,0.25)",
            }}
          >
            {initials}
          </Avatar>

          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.2, mb: 0.6 }}>
              <Typography
                sx={{
                  fontFamily: FONT,
                  fontSize: "22px",
                  fontWeight: 700,
                  color: INK,
                  letterSpacing: "-0.5px",
                }}
              >
                {fullName}
              </Typography>

              <Chip
                label={employee.employee_code}
                size="small"
                sx={{
                  fontFamily: FONT,
                  fontWeight: 700,
                  fontSize: "11px",
                  backgroundColor: "rgba(22,24,29,0.12)",
                  color: TEAL,
                  borderRadius: "6px",
                }}
              />

              <Chip
                label={employee.status}
                size="small"
                sx={{
                  fontFamily: FONT,
                  fontWeight: 600,
                  fontSize: "11px",
                  backgroundColor:
                    employee.status === "ACTIVE"
                      ? "rgba(16, 185, 129, 0.12)"
                      : "rgba(245, 158, 11, 0.12)",
                  color: employee.status === "ACTIVE" ? "#059669" : "#D97706",
                  borderRadius: "6px",
                }}
              />
            </Box>

            <Typography sx={{ fontFamily: FONT, fontSize: "14px", color: MUTED }}>
              {employee.designation_name || "Designation not set"} •{" "}
              {employee.department_name || "Department not set"}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {employee.profile_completed ? (
              <Chip
                icon={<CheckCircleRounded sx={{ fontSize: "15px !important", color: "#16181D !important" }} />}
                label="Profile Completed"
                size="small"
                sx={{
                  fontFamily: FONT,
                  fontWeight: 600,
                  fontSize: "11px",
                  backgroundColor: "rgba(22,24,29,0.1)",
                  color: TEAL,
                }}
              />
            ) : (
              <Chip
                icon={<HourglassEmptyRounded sx={{ fontSize: "15px !important", color: "#D97706 !important" }} />}
                label="Profile Incomplete"
                size="small"
                sx={{
                  fontFamily: FONT,
                  fontWeight: 600,
                  fontSize: "11px",
                  backgroundColor: "rgba(245,158,11,0.1)",
                  color: "#D97706",
                }}
              />
            )}
          </Box>
        </Box>

        {/* 2 Column Details Section */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 3,
          }}
        >
          {/* Column 1: Employment Details */}
          <Box
            sx={{
              p: 2.5,
              borderRadius: "14px",
              border: `1px solid ${BORDER}`,
              backgroundColor: "#FFFFFF",
            }}
          >
            <Typography
              sx={{
                fontFamily: FONT,
                fontSize: "15px",
                fontWeight: 700,
                color: INK,
                mb: 1.5,
              }}
            >
              Employment Information
            </Typography>
            <Divider sx={{ mb: 1.5, borderColor: "#EBE8E1" }} />

            <DetailRow
              icon={<WorkOutlineRounded />}
              label="Assigned Role"
              value={employee.role_name || "Employee"}
            />
            <DetailRow
              icon={<BusinessOutlined />}
              label="Department"
              value={employee.department_name}
            />
            <DetailRow
              icon={<BadgeOutlined />}
              label="Designation"
              value={employee.designation_name}
            />
            <DetailRow
              icon={<CalendarMonthOutlined />}
              label="Date of Joining"
              value={employee.date_of_joining}
            />
            <DetailRow
              icon={<WorkOutlineRounded />}
              label="Employment Type"
              value={employee.employment_type?.replace("_", " ")}
            />
            <DetailRow
              icon={<BadgeOutlined />}
              label="Reporting Manager"
              value={employee.manager_name || "None"}
            />
          </Box>

          {/* Column 2: Personal & Contact Information */}
          <Box
            sx={{
              p: 2.5,
              borderRadius: "14px",
              border: `1px solid ${BORDER}`,
              backgroundColor: "#FFFFFF",
            }}
          >
            <Typography
              sx={{
                fontFamily: FONT,
                fontSize: "15px",
                fontWeight: 700,
                color: INK,
                mb: 1.5,
              }}
            >
              Personal & Contact Details
            </Typography>
            <Divider sx={{ mb: 1.5, borderColor: "#EBE8E1" }} />

            <DetailRow
              icon={<EmailOutlined />}
              label="Official Email"
              value={employee.email}
            />
            <DetailRow
              icon={<PhoneOutlined />}
              label="Phone Number"
              value={employee.phone}
            />
            <DetailRow
              icon={<CalendarMonthOutlined />}
              label="Date of Birth"
              value={employee.dob}
            />
            <DetailRow
              icon={<LocationOnOutlined />}
              label="Residential Address"
              value={fullAddress || "No address entered yet"}
            />
          </Box>
        </Box>

        {/* Action Button at bottom */}
        <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid #F0EFEB", display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={onClose}
            sx={{
              borderRadius: "10px",
              borderColor: BORDER,
              color: MUTED,
              textTransform: "none",
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: "13px",
              "&:hover": { borderColor: INK, color: INK },
            }}
          >
            Close
          </Button>

          <Button
            variant="contained"
            startIcon={<EditOutlined />}
            onClick={() => {
              onClose();
              navigate(`/employees/${employee.employee_id}`);
            }}
            sx={{
              borderRadius: "10px",
              backgroundColor: TEAL,
              color: "#FFFFFF",
              textTransform: "none",
              fontFamily: FONT,
              fontSize: "13px",
              fontWeight: 600,
              px: 2.5,
              "&:hover": { backgroundColor: "#0C5F58" },
            }}
          >
            Edit Profile
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
