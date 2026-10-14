import { useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AddRounded,
  CheckCircleOutlineRounded,
  LockResetRounded,
  RefreshRounded,
  SearchRounded,
  VisibilityOutlined,
  WarningAmberRounded,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

import api from "../../services/api";
import { can } from "../../utils/permissions";
import { getErrorMessage } from "../../utils/errors";
import type { EmployeeDetail } from "../../types/employee";
import EmployeeProfileModal from "./EmployeeProfileModal";

const FONT = "'Montserrat', sans-serif";
const INK = "#16181D";
const TEAL = "#16181D";
const MUTED = "#6B6F76";
const BORDER = "#DAD7CF";

interface EmployeeDirectoryProps {
  employees: EmployeeDetail[];
  loading: boolean;
  onRefresh: () => void;
  canManage?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export default function EmployeeDirectory({
  employees,
  loading,
  onRefresh,
  canManage = true,
  searchQuery: externalSearchQuery,
  onSearchChange: externalOnSearchChange,
}: EmployeeDirectoryProps) {
  const navigate = useNavigate();
  const isHR = can("user.update");

  const [internalSearch, setInternalSearch] = useState("");
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearch;
  const handleSearchChange = (val: string) => {
    if (externalOnSearchChange) {
      externalOnSearchChange(val);
    } else {
      setInternalSearch(val);
    }
  };

  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [activeEmployee, setActiveEmployee] = useState<EmployeeDetail | null>(null);

  // Status Change Dialog State
  const [statusDialogTarget, setStatusDialogTarget] = useState<EmployeeDetail | null>(null);
  const [pendingNewStatus, setPendingNewStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Password Reset Dialog State
  const [resetDialogTarget, setResetDialogTarget] = useState<EmployeeDetail | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Banner message
  const [banner, setBanner] = useState<{
    severity: "success" | "error" | "info";
    message: string;
    tempPassword?: string;
  } | null>(null);

  // Departments list for filtering
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((emp) => {
      if (emp.department_name) set.add(emp.department_name);
    });
    return Array.from(set);
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = (searchQuery || "").toLowerCase().trim();
      const name = `${emp.first_name || ""} ${emp.last_name || ""}`.toLowerCase();
      const code = (emp.employee_code || "").toLowerCase();
      const email = (emp.email || "").toLowerCase();

      const matchesSearch = !q || name.includes(q) || code.includes(q) || email.includes(q);
      const matchesDept = selectedDept === "ALL" || emp.department_name === selectedDept;
      const matchesStatus =
        selectedStatus === "ALL" ||
        emp.status === selectedStatus ||
        (selectedStatus === "INACTIVE" && (!emp.is_active || emp.status === "INACTIVE"));

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [employees, searchQuery, selectedDept, selectedStatus]);

  // Handle status toggle initiation
  const handleInitiateStatusChange = (emp: EmployeeDetail, targetStatus: "ACTIVE" | "INACTIVE") => {
    setStatusDialogTarget(emp);
    setPendingNewStatus(targetStatus);
  };

  // Confirm and execute status change
  const handleConfirmStatusChange = async () => {
    if (!statusDialogTarget) return;

    setStatusUpdating(true);
    setBanner(null);

    try {
      await api.patch(`/employees/${statusDialogTarget.employee_id}/status`, {
        status: pendingNewStatus,
      });

      setBanner({
        severity: "success",
        message: `Employee ${statusDialogTarget.employee_code} account has been ${
          pendingNewStatus === "ACTIVE" ? "reactivated successfully" : "deactivated. HRMS account access is revoked immediately."
        }`,
      });

      setStatusDialogTarget(null);
      onRefresh();
    } catch (err: unknown) {
      setBanner({
        severity: "error",
        message: getErrorMessage(err, "Failed to update employee status."),
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  // Execute password reset
  const handleConfirmPasswordReset = async () => {
    if (!resetDialogTarget) return;

    setResettingPassword(true);
    setBanner(null);

    try {
      const { data } = await api.post(`/employees/${resetDialogTarget.employee_id}/reset-password`);

      setBanner({
        severity: "success",
        message: data.message || `Password reset successfully for ${resetDialogTarget.email}.`,
        tempPassword: data.temporary_password,
      });

      setResetDialogTarget(null);
    } catch (err: unknown) {
      setBanner({
        severity: "error",
        message: getErrorMessage(err, "Failed to reset employee password."),
      });
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <Box>
      {/* Feedback Banner */}
      {banner && (
        <Alert
          severity={banner.severity}
          onClose={() => setBanner(null)}
          sx={{
            mb: 3,
            borderRadius: "12px",
            fontFamily: FONT,
            fontSize: "13px",
            border: `1px solid ${
              banner.severity === "success"
                ? "rgba(16, 185, 129, 0.3)"
                : "rgba(239, 68, 68, 0.3)"
            }`,
          }}
        >
          <Box>
            <Typography sx={{ fontFamily: FONT, fontSize: "13px", fontWeight: 600 }}>
              {banner.message}
            </Typography>
            {banner.tempPassword && (
              <Box sx={{ mt: 1, p: 1, backgroundColor: "rgba(0,0,0,0.04)", borderRadius: "6px" }}>
                <Typography sx={{ fontFamily: FONT, fontSize: "12px", fontWeight: 700, color: INK }}>
                  Temporary Password (Dev mode): <code>{banner.tempPassword}</code>
                </Typography>
              </Box>
            )}
          </Box>
        </Alert>
      )}

      {/* Top action & filter bar */}
      <Box
        sx={{
          backgroundColor: "#FFFFFF",
          border: `1px solid ${BORDER}`,
          borderRadius: "16px",
          p: 2.5,
          mb: 3,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "stretch", md: "center" },
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", flex: 1, gap: 1.5, flexWrap: "wrap" }}>
          {/* Search Field */}
          <TextField
            placeholder="Search by name, code or email…"
            size="small"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded sx={{ color: MUTED, fontSize: 20 }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              minWidth: { xs: "100%", sm: 280 },
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                fontFamily: FONT,
                fontSize: "13px",
                backgroundColor: "#FAF9F6",
                "& fieldset": { borderColor: BORDER },
                "&:hover fieldset": { borderColor: "#A9A69D" },
                "&.Mui-focused fieldset": { borderColor: TEAL },
              },
            }}
          />

          {/* Department Filter */}
          <FormControl
            size="small"
            sx={{
              minWidth: 160,
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                fontFamily: FONT,
                fontSize: "13px",
                backgroundColor: "#FAF9F6",
                "& fieldset": { borderColor: BORDER },
              },
            }}
          >
            <Select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              displayEmpty
            >
              <MenuItem value="ALL" sx={{ fontFamily: FONT, fontSize: "13px" }}>
                All Departments
              </MenuItem>
              {departments.map((dept) => (
                <MenuItem key={dept} value={dept} sx={{ fontFamily: FONT, fontSize: "13px" }}>
                  {dept}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Status Filter */}
          <FormControl
            size="small"
            sx={{
              minWidth: 140,
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                fontFamily: FONT,
                fontSize: "13px",
                backgroundColor: "#FAF9F6",
                "& fieldset": { borderColor: BORDER },
              },
            }}
          >
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              displayEmpty
            >
              <MenuItem value="ALL" sx={{ fontFamily: FONT, fontSize: "13px" }}>
                All Status
              </MenuItem>
              <MenuItem value="ACTIVE" sx={{ fontFamily: FONT, fontSize: "13px" }}>
                Active
              </MenuItem>
              <MenuItem value="INACTIVE" sx={{ fontFamily: FONT, fontSize: "13px" }}>
                Inactive
              </MenuItem>
              <MenuItem value="ONBOARDING" sx={{ fontFamily: FONT, fontSize: "13px" }}>
                Onboarding
              </MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Tooltip title="Refresh Directory">
            <IconButton
              onClick={onRefresh}
              disabled={loading}
              sx={{
                border: `1px solid ${BORDER}`,
                borderRadius: "10px",
                color: INK,
                "&:hover": { backgroundColor: "#FAF9F6" },
              }}
            >
              <RefreshRounded sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>

          {canManage && (
            <Button
              startIcon={<AddRounded />}
              onClick={() => navigate("/employees/create")}
              sx={{
                height: 40,
                px: 2.2,
                borderRadius: "10px",
                backgroundColor: INK,
                color: "#FFFFFF",
                textTransform: "none",
                fontFamily: FONT,
                fontSize: "13px",
                fontWeight: 600,
                "&:hover": { backgroundColor: "#2B2F38" },
              }}
            >
              Create Employee
            </Button>
          )}
        </Box>
      </Box>

      {/* Employees Table Container */}
      <TableContainer
        sx={{
          backgroundColor: "#FFFFFF",
          border: `1px solid ${BORDER}`,
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        <Table sx={{ minWidth: 800 }}>
          <TableHead sx={{ backgroundColor: "#FAF9F6" }}>
            <TableRow>
              <TableCell sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "12px", color: MUTED }}>
                EMPLOYEE
              </TableCell>
              <TableCell sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "12px", color: MUTED }}>
                CODE
              </TableCell>
              <TableCell sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "12px", color: MUTED }}>
                DEPARTMENT & ROLE
              </TableCell>
              <TableCell sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "12px", color: MUTED }}>
                JOINING DATE
              </TableCell>
              <TableCell sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "12px", color: MUTED }}>
                STATUS
              </TableCell>
              <TableCell sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "12px", color: MUTED }}>
                PROFILE
              </TableCell>
              <TableCell
                align="right"
                sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "12px", color: MUTED }}
              >
                ACTIONS
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} sx={{ color: TEAL, mb: 1 }} />
                  <Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: "13px" }}>
                    Loading employee records…
                  </Typography>
                </TableCell>
              </TableRow>
            ) : filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: "14px", fontWeight: 600 }}>
                    No employees found matching the filters.
                  </Typography>
                  <Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: "12px", mt: 0.5 }}>
                    Try clearing the search query or adjusting your filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((emp) => {
                const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "Employee";
                const initials = `${(emp.first_name?.[0] || "").toUpperCase()}${(emp.last_name?.[0] || "").toUpperCase()}` || "EM";
                const isActive = emp.is_active && emp.status === "ACTIVE";
                const isInactive = !emp.is_active || emp.status === "INACTIVE";

                return (
                  <TableRow
                    key={emp.employee_id}
                    hover
                    sx={{
                      cursor: "pointer",
                      "&:hover": { backgroundColor: "rgba(22,24,29,0.03)" },
                    }}
                    onClick={() => setActiveEmployee(emp)}
                  >
                    {/* Employee Avatar & Name */}
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar
                          sx={{
                            width: 38,
                            height: 38,
                            bgcolor: "rgba(22,24,29,0.12)",
                            color: TEAL,
                            fontFamily: FONT,
                            fontSize: "13px",
                            fontWeight: 700,
                          }}
                        >
                          {initials}
                        </Avatar>
                        <Box>
                          <Typography
                            sx={{
                              fontFamily: FONT,
                              fontSize: "13px",
                              fontWeight: 700,
                              color: INK,
                            }}
                          >
                            {fullName}
                          </Typography>
                          <Typography
                            sx={{
                              fontFamily: FONT,
                              fontSize: "11px",
                              color: MUTED,
                            }}
                          >
                            {emp.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    {/* Employee Code */}
                    <TableCell>
                      <Chip
                        label={emp.employee_code}
                        size="small"
                        sx={{
                          fontFamily: FONT,
                          fontWeight: 700,
                          fontSize: "11px",
                          backgroundColor: "#F5F4F0",
                          color: INK,
                          borderRadius: "6px",
                        }}
                      />
                    </TableCell>

                    {/* Department & Role */}
                    <TableCell>
                      <Typography
                        sx={{
                          fontFamily: FONT,
                          fontSize: "13px",
                          fontWeight: 600,
                          color: INK,
                        }}
                      >
                        {emp.department_name || "—"}
                      </Typography>
                      <Typography
                        sx={{
                          fontFamily: FONT,
                          fontSize: "11px",
                          color: MUTED,
                        }}
                      >
                        {emp.designation_name || emp.role_name || "—"}
                      </Typography>
                    </TableCell>

                    {/* Joining Date */}
                    <TableCell>
                      <Typography
                        sx={{
                          fontFamily: FONT,
                          fontSize: "12px",
                          color: INK,
                        }}
                      >
                        {emp.date_of_joining}
                      </Typography>
                    </TableCell>

                    {/* Editable Status */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {isHR ? (
                        <Tooltip
                          title={
                            isActive
                              ? "Click to deactivate employee account"
                              : "Click to reactivate employee account"
                          }
                        >
                          <Chip
                            label={isActive ? "Active" : isInactive ? "Inactive" : emp.status}
                            size="small"
                            onClick={() =>
                              handleInitiateStatusChange(
                                emp,
                                isActive ? "INACTIVE" : "ACTIVE"
                              )
                            }
                            sx={{
                              fontFamily: FONT,
                              fontWeight: 700,
                              fontSize: "11px",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              backgroundColor: isActive
                                ? "rgba(16, 185, 129, 0.12)"
                                : isInactive
                                ? "rgba(239, 68, 68, 0.12)"
                                : "rgba(245, 158, 11, 0.12)",
                              color: isActive
                                ? "#059669"
                                : isInactive
                                ? "#DC2626"
                                : "#D97706",
                              border: "1px solid transparent",
                              "&:hover": {
                                borderColor: isActive ? "#059669" : "#DC2626",
                                transform: "scale(1.04)",
                              },
                            }}
                          />
                        </Tooltip>
                      ) : (
                        <Chip
                          label={emp.status}
                          size="small"
                          sx={{
                            fontFamily: FONT,
                            fontWeight: 700,
                            fontSize: "11px",
                            backgroundColor:
                              emp.status === "ACTIVE"
                                ? "rgba(16, 185, 129, 0.12)"
                                : "rgba(245, 158, 11, 0.12)",
                            color: emp.status === "ACTIVE" ? "#059669" : "#D97706",
                            borderRadius: "6px",
                          }}
                        />
                      )}
                    </TableCell>

                    {/* Profile Completed */}
                    <TableCell>
                      {emp.profile_completed ? (
                        <Chip
                          label="Complete"
                          size="small"
                          sx={{
                            fontFamily: FONT,
                            fontWeight: 600,
                            fontSize: "10px",
                            backgroundColor: "rgba(22,24,29,0.1)",
                            color: TEAL,
                            borderRadius: "6px",
                          }}
                        />
                      ) : (
                        <Chip
                          label="Pending"
                          size="small"
                          sx={{
                            fontFamily: FONT,
                            fontWeight: 600,
                            fontSize: "10px",
                            backgroundColor: "#F0EFEB",
                            color: MUTED,
                            borderRadius: "6px",
                          }}
                        />
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
                        <Button
                          size="small"
                          startIcon={<VisibilityOutlined sx={{ fontSize: 16 }} />}
                          onClick={() => setActiveEmployee(emp)}
                          sx={{
                            textTransform: "none",
                            fontFamily: FONT,
                            fontSize: "12px",
                            fontWeight: 600,
                            color: TEAL,
                            borderRadius: "8px",
                            "&:hover": { backgroundColor: "rgba(22,24,29,0.08)" },
                          }}
                        >
                          View Profile
                        </Button>

                        {isHR && (
                          <Tooltip title="Reset Password">
                            <IconButton
                              size="small"
                              onClick={() => setResetDialogTarget(emp)}
                              sx={{
                                color: MUTED,
                                border: `1px solid ${BORDER}`,
                                borderRadius: "8px",
                                p: 0.6,
                                "&:hover": { color: INK, borderColor: INK, backgroundColor: "#FAF9F6" },
                              }}
                            >
                              <LockResetRounded sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Confirmation Dialog: Status Deactivation / Activation */}
      <Dialog
        open={Boolean(statusDialogTarget)}
        onClose={() => !statusUpdating && setStatusDialogTarget(null)}
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              p: 1,
              maxWidth: 440,
            },
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "10px",
              backgroundColor:
                pendingNewStatus === "INACTIVE" ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
              color: pendingNewStatus === "INACTIVE" ? "#DC2626" : "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {pendingNewStatus === "INACTIVE" ? (
              <WarningAmberRounded sx={{ fontSize: 24 }} />
            ) : (
              <CheckCircleOutlineRounded sx={{ fontSize: 24 }} />
            )}
          </Box>
          <Typography sx={{ fontFamily: FONT, fontSize: "18px", fontWeight: 700, color: INK }}>
            {pendingNewStatus === "INACTIVE" ? "Deactivate Account?" : "Reactivate Account?"}
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ py: 1 }}>
          <Typography sx={{ fontFamily: FONT, fontSize: "13px", color: MUTED, lineHeight: 1.6 }}>
            {pendingNewStatus === "INACTIVE" ? (
              <>
                Are you sure you want to deactivate account access for{" "}
                <strong style={{ color: INK }}>
                  {statusDialogTarget?.first_name} {statusDialogTarget?.last_name}
                </strong>{" "}
                ({statusDialogTarget?.employee_code})?
                <br />
                <br />
                <strong>Security enforcement:</strong> The employee's HRMS login credentials and all
                active JWT tokens will be invalidated immediately. They will be logged out everywhere
                and cannot log back in until reactivated.
              </>
            ) : (
              <>
                Are you sure you want to reactivate account access for{" "}
                <strong style={{ color: INK }}>
                  {statusDialogTarget?.first_name} {statusDialogTarget?.last_name}
                </strong>{" "}
                ({statusDialogTarget?.employee_code})?
                <br />
                <br />
                Their status will return to <strong>ACTIVE</strong> and they will be permitted to log in
                again using their credentials.
              </>
            )}
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
          <Button
            onClick={() => setStatusDialogTarget(null)}
            disabled={statusUpdating}
            sx={{
              textTransform: "none",
              fontFamily: FONT,
              fontWeight: 600,
              color: MUTED,
            }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={handleConfirmStatusChange}
            disabled={statusUpdating}
            sx={{
              textTransform: "none",
              fontFamily: FONT,
              fontWeight: 600,
              borderRadius: "10px",
              px: 2.5,
              backgroundColor: pendingNewStatus === "INACTIVE" ? "#DC2626" : TEAL,
              "&:hover": {
                backgroundColor: pendingNewStatus === "INACTIVE" ? "#B91C1C" : "#0C5F58",
              },
            }}
          >
            {statusUpdating ? (
              <CircularProgress size={18} sx={{ color: "#FFFFFF" }} />
            ) : pendingNewStatus === "INACTIVE" ? (
              "Yes, Deactivate Account"
            ) : (
              "Yes, Reactivate Account"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog: Password Reset */}
      <Dialog
        open={Boolean(resetDialogTarget)}
        onClose={() => !resettingPassword && setResetDialogTarget(null)}
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              p: 1,
              maxWidth: 440,
            },
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "10px",
              backgroundColor: "rgba(22,24,29,0.1)",
              color: TEAL,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LockResetRounded sx={{ fontSize: 24 }} />
          </Box>
          <Typography sx={{ fontFamily: FONT, fontSize: "18px", fontWeight: 700, color: INK }}>
            Reset Employee Password?
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ py: 1 }}>
          <Typography sx={{ fontFamily: FONT, fontSize: "13px", color: MUTED, lineHeight: 1.6 }}>
            Are you sure you want to reset the password for{" "}
            <strong style={{ color: INK }}>
              {resetDialogTarget?.first_name} {resetDialogTarget?.last_name}
            </strong>{" "}
            ({resetDialogTarget?.email})?
            <br />
            <br />
            A secure temporary password will be generated and dispatched to their email address.
            Existing sessions will be terminated, and they will be required to change their password
            on their next login.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
          <Button
            onClick={() => setResetDialogTarget(null)}
            disabled={resettingPassword}
            sx={{
              textTransform: "none",
              fontFamily: FONT,
              fontWeight: 600,
              color: MUTED,
            }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={handleConfirmPasswordReset}
            disabled={resettingPassword}
            sx={{
              textTransform: "none",
              fontFamily: FONT,
              fontWeight: 600,
              borderRadius: "10px",
              px: 2.5,
              backgroundColor: INK,
              "&:hover": { backgroundColor: "#2B2F38" },
            }}
          >
            {resettingPassword ? (
              <CircularProgress size={18} sx={{ color: "#FFFFFF" }} />
            ) : (
              "Confirm Reset Password"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Profile Details Dialog with Edit Profile support */}
      <EmployeeProfileModal
        open={Boolean(activeEmployee)}
        employee={activeEmployee}
        onClose={() => setActiveEmployee(null)}
        onSaved={onRefresh}
      />
    </Box>
  );
}
