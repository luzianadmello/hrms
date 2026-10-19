import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
  TablePagination,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArrowDropDownRounded,
  CheckCircleOutlineRounded,
  EventAvailableOutlined,
  GroupsOutlined,
  LockResetRounded,
  PersonAddAlt1Rounded,
  RefreshRounded,
  SearchRounded,
  VisibilityOutlined,
  WarningAmberRounded,
} from "@mui/icons-material";
import { useNavigate, useSearchParams } from "react-router-dom";

import AppLayout from "../../components/layout/AppLayout";
import EmployeeProfileModal from "../../components/employees/EmployeeProfileModal";
import StatusChip from "../../components/employees/StatusChip";
import ActionToast from "../../components/common/ActionToast";
import api from "../../services/api";
import { can } from "../../utils/permissions";
import { getErrorMessage } from "../../utils/errors";
import type {
  EmployeeDetail,
  EmployeeStats,
  StatusChangeResponse,
} from "../../types/employee";

const FONT = "'Montserrat', sans-serif";
const INK = "#16181D";
const TEAL = "#16181D";
const MUTED = "#6B6F76";
const BORDER = "#DAD7CF";

export default function EmployeeManagement() {
  const navigate = useNavigate();
  const canCreate = can("user.create");
  const isHR = can("employee.update");

  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeDetail[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState(
    searchParams.get("status") || "ALL"
  );
  const [activeEmployee, setActiveEmployee] = useState<EmployeeDetail | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<"employee_code" | "date_of_joining">("employee_code");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [statusDialogTarget, setStatusDialogTarget] = useState<EmployeeDetail | null>(null);
  const [pendingNewStatus, setPendingNewStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [resetDialogTarget, setResetDialogTarget] = useState<EmployeeDetail | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [banner, setBanner] = useState<{
    severity: "success" | "error";
    message: string;
  } | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<EmployeeStats>("/employees/stats");
      setStats(res.data);
    } catch (error) {
      console.error("Failed to load employee statistics from /employees/stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // The navbar search and the dashboard cards link here with ?q= / ?status=
  useEffect(() => {
    setSearchQuery(searchParams.get("q") || "");
    setSelectedStatus(searchParams.get("status") || "ALL");
  }, [searchParams]);

  const fetchEmployees = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await api.get<EmployeeDetail[]>("/employees");
      setEmployees(res.data);
    } catch {
      // handled
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const departments = useMemo(() => {
    const names = new Set<string>();
    employees.forEach((employee) => { if (employee.department_name) names.add(employee.department_name); });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = searchQuery.toLowerCase().trim();
      const name = `${emp.first_name || ""} ${emp.last_name || ""}`.toLowerCase();
      const code = (emp.employee_code || "").toLowerCase();
      const email = (emp.email || "").toLowerCase();
      const matchesSearch = !q || name.includes(q) || code.includes(q) || email.includes(q);
      const matchesDept = selectedDept === "ALL" || emp.department_name === selectedDept;
      const matchesStatus = selectedStatus === "ALL" || emp.status === selectedStatus;
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [employees, searchQuery, selectedDept, selectedStatus]);

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    const comparison = sortBy === "employee_code"
      ? (a.employee_code || "").localeCompare(b.employee_code || "", undefined, { numeric: true })
      : (a.date_of_joining || "").localeCompare(b.date_of_joining || "");
    return sortDirection === "asc" ? comparison : -comparison;
  });
  const paginatedEmployees = sortedEmployees.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleSort = (column: "employee_code" | "date_of_joining") => {
    if (sortBy === column) setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    else {
      setSortBy(column);
      setSortDirection("asc");
    }
    setPage(0);
  };

  const handleInitiateStatusChange = (emp: EmployeeDetail, target: "ACTIVE" | "INACTIVE") => {
    setStatusDialogTarget(emp);
    setPendingNewStatus(target);
  };

  const handleConfirmStatusChange = async () => {
    if (!statusDialogTarget) return;
    setStatusUpdating(true);
    setBanner(null);
    try {
      await api.patch<StatusChangeResponse>(
        `/employees/${statusDialogTarget.employee_id}/status`,
        { status: pendingNewStatus }
      );
      setBanner({
        severity: "success",
        message:
          pendingNewStatus === "ACTIVE"
            ? `Employee activated successfully. Login details sent to ${statusDialogTarget.email}.`
            : "Employee deactivated successfully. All active sessions have been revoked.",
      });
      setStatusDialogTarget(null);
      fetchEmployees();
      fetchStats();
    } catch (err: unknown) {
      // e.g. "The email could not be sent. Nothing was changed."
      setBanner({ severity: "error", message: getErrorMessage(err, "Failed to update status.") });
      setStatusDialogTarget(null);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleConfirmPasswordReset = async () => {
    if (!resetDialogTarget) return;
    setResettingPassword(true);
    setBanner(null);
    try {
      const { data } = await api.post(`/employees/${resetDialogTarget.employee_id}/reset-password`);
      setBanner({
        severity: "success",
        message: data.message || `Password reset successfully. Login details sent to ${resetDialogTarget.email}.`,
      });
      setResetDialogTarget(null);
    } catch (err: unknown) {
      setBanner({ severity: "error", message: getErrorMessage(err, "Failed to reset password.") });
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <AppLayout pageTitle="Employees">
      {/* Page Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          mb: 4,
        }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: FONT,
              fontSize: "12px",
              fontWeight: 700,
              color: TEAL,
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              mb: 0.5,
            }}
          >
            Workforce Operations
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontFamily: FONT,
              fontSize: { xs: "22px", md: "26px" },
              fontWeight: 700,
              color: INK,
              letterSpacing: "-0.6px",
            }}
          >
            Employees
          </Typography>
          <Typography sx={{ fontFamily: FONT, fontSize: "13px", color: MUTED, mt: 0.4 }}>
            View, manage, and onboard employees across your organisation.
          </Typography>
        </Box>
        {canCreate && (
          <Button
            startIcon={<PersonAddAlt1Rounded />}
            onClick={() => navigate("/employees/create")}
            sx={{
              height: 44,
              px: 3,
              borderRadius: "10px",
              backgroundColor: INK,
              color: "#FFFFFF",
              textTransform: "none",
              fontFamily: FONT,
              fontSize: "13px",
              fontWeight: 600,
              flexShrink: 0,
              "&:hover": { backgroundColor: "#2B2F38", boxShadow: "0 4px 14px rgba(0,0,0,0.18)" },
            }}
          >
            Create Employee
          </Button>
        )}
      </Box>

      {/* Stats Cards */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
          gap: 2,
          mb: 4,
        }}
      >
        {[
          { icon: <GroupsOutlined sx={{ fontSize: 18 }} />, label: "Total Staff", value: stats?.total_employees, color: INK, bg: "rgba(22,24,29,0.06)" },
          { icon: <GroupsOutlined sx={{ fontSize: 18 }} />, label: "Active", value: stats?.active_employees, color: "#059669", bg: "rgba(16,185,129,0.08)" },
          { icon: <GroupsOutlined sx={{ fontSize: 18 }} />, label: "Inactive", value: stats?.inactive_employees, color: "#DC2626", bg: "rgba(239,68,68,0.08)" },
          { icon: <EventAvailableOutlined sx={{ fontSize: 18 }} />, label: "Profile incomplete", value: stats?.profile_incomplete, color: "#D97706", bg: "rgba(245,158,11,0.08)" },
        ].map((stat) => (
          <Box
            key={stat.label}
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: "16px",
              backgroundColor: "#FFFFFF",
              border: `1px solid ${BORDER}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: "9px",
                backgroundColor: stat.bg,
                color: stat.color,
                mb: 1,
              }}
            >
              {stat.icon}
            </Box>
            <Typography sx={{ fontFamily: FONT, fontSize: "11px", fontWeight: 600, color: MUTED }}>
              {stat.label}
            </Typography>
            {statsLoading ? (
              <CircularProgress size={18} sx={{ color: TEAL, mt: 0.5 }} />
            ) : (
              <Typography sx={{ fontFamily: FONT, fontSize: "26px", fontWeight: 700, color: stat.color, lineHeight: 1.2, mt: 0.3 }}>
                {stat.value ?? "—"}
              </Typography>
            )}
          </Box>
        ))}
      </Box>

      <ActionToast
        open={Boolean(banner)}
        severity={banner?.severity ?? "info"}
        message={banner?.message ?? ""}
        onClose={() => setBanner(null)}
      />

      {/* Filter Bar */}
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
          <TextField
            placeholder="Search by name, code or email…"
            size="small"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
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
          <FormControl
            size="small"
            sx={{
              minWidth: 160,
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px", fontFamily: FONT, fontSize: "13px",
                backgroundColor: "#FAF9F6", "& fieldset": { borderColor: BORDER },
              },
            }}
          >
            <Select value={selectedDept} onChange={(e) => { setSelectedDept(e.target.value); setPage(0); }} displayEmpty>
              <MenuItem value="ALL" sx={{ fontFamily: FONT, fontSize: "13px" }}>All Departments</MenuItem>
              {departments.map((dept) => <MenuItem key={dept} value={dept} sx={{ fontFamily: FONT, fontSize: "13px" }}>{dept}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl
            size="small"
            sx={{
              minWidth: 140,
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px", fontFamily: FONT, fontSize: "13px",
                backgroundColor: "#FAF9F6", "& fieldset": { borderColor: BORDER },
              },
            }}
          >
            <Select value={selectedStatus} onChange={(e) => { setSelectedStatus(e.target.value); setPage(0); }} displayEmpty>
              <MenuItem value="ALL" sx={{ fontFamily: FONT, fontSize: "13px" }}>All Status</MenuItem>
              <MenuItem value="ACTIVE" sx={{ fontFamily: FONT, fontSize: "13px" }}>Active</MenuItem>
              <MenuItem value="INACTIVE" sx={{ fontFamily: FONT, fontSize: "13px" }}>Inactive</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Tooltip title="Refresh list">
          <IconButton
            onClick={fetchEmployees}
            disabled={listLoading}
            sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", color: INK, "&:hover": { backgroundColor: "#FAF9F6" } }}
          >
            <RefreshRounded sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Employee Table */}
      <TableContainer
        sx={{ backgroundColor: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: "16px", overflow: "hidden" }}
      >
        <Table sx={{ minWidth: 800 }}>
          <TableHead sx={{ backgroundColor: "#FAF9F6" }}>
            <TableRow>
              {["EMPLOYEE", "CODE", "DEPARTMENT & ROLE", "JOINING DATE", "STATUS", "PROFILE", "ACTIONS"].map((col, i) => (
                <TableCell
                  key={col}
                  align={i === 6 ? "right" : "left"}
                  sortDirection={(i === 1 && sortBy === "employee_code") || (i === 3 && sortBy === "date_of_joining") ? sortDirection : false}
                  sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "12px", color: MUTED }}
                >
                  {i === 1 || i === 3 ? (
                    <TableSortLabel
                      active={(i === 1 && sortBy === "employee_code") || (i === 3 && sortBy === "date_of_joining")}
                      direction={i === 1 ? (sortBy === "employee_code" ? sortDirection : "asc") : (sortBy === "date_of_joining" ? sortDirection : "asc")}
                      onClick={() => handleSort(i === 1 ? "employee_code" : "date_of_joining")}
                      IconComponent={ArrowDropDownRounded}
                      sx={{
                        fontFamily: FONT,
                        fontWeight: 700,
                        fontSize: "12px",
                        color: MUTED,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: "3px",
                        "& .MuiTableSortLabel-icon": {
                          margin: 0,
                          opacity: 1,
                          color: `${MUTED} !important`,
                          transform: ((i === 1 && sortBy === "employee_code") || (i === 3 && sortBy === "date_of_joining") ? sortDirection : "asc") === "asc" ? "rotate(0deg) !important" : "rotate(180deg) !important",
                        },
                      }}
                    >
                      {col}
                    </TableSortLabel>
                  ) : col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {listLoading ? (
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
                    No employees found.
                  </Typography>
                  <Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: "12px", mt: 0.5 }}>
                    Try adjusting your search or filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedEmployees.map((emp) => {
                const fullName = `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "Employee";
                const initials = `${(emp.first_name?.[0] || "").toUpperCase()}${(emp.last_name?.[0] || "").toUpperCase()}` || "EM";
                const isActive = emp.status === "ACTIVE";
                return (
                  <TableRow
                    key={emp.employee_id}
                    hover
                    sx={{ cursor: "pointer", "&:hover": { backgroundColor: "rgba(22,24,29,0.03)" } }}
                    onClick={() => setActiveEmployee(emp)}
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar sx={{ width: 38, height: 38, bgcolor: "rgba(22,24,29,0.12)", color: TEAL, fontFamily: FONT, fontSize: "13px", fontWeight: 700 }}>
                          {initials}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontFamily: FONT, fontSize: "13px", fontWeight: 700, color: INK }}>{fullName}</Typography>
                          <Typography sx={{ fontFamily: FONT, fontSize: "11px", color: MUTED }}>{emp.email}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={emp.employee_code} size="small" sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "11px", backgroundColor: "#F5F4F0", color: INK, borderRadius: "6px" }} />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontFamily: FONT, fontSize: "13px", fontWeight: 600, color: INK }}>{emp.department_name || "—"}</Typography>
                      <Typography sx={{ fontFamily: FONT, fontSize: "11px", color: MUTED }}>{emp.designation_name || emp.role_name || "—"}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontFamily: FONT, fontSize: "12px", color: INK }}>{emp.date_of_joining}</Typography>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {isHR ? (
                        <Tooltip title={isActive ? "Click to deactivate" : "Click to activate"}>
                          <span>
                            <StatusChip
                              status={emp.status}
                              onClick={() => handleInitiateStatusChange(emp, isActive ? "INACTIVE" : "ACTIVE")}
                            />
                          </span>
                        </Tooltip>
                      ) : (
                        <StatusChip status={emp.status} />
                      )}
                    </TableCell>
                    <TableCell>
                      {emp.profile_completed ? (
                        <Chip label="Complete" size="small" sx={{ fontFamily: FONT, fontWeight: 600, fontSize: "10px", backgroundColor: "rgba(22,24,29,0.1)", color: TEAL, borderRadius: "6px" }} />
                      ) : (
                        <Chip label="Pending" size="small" sx={{ fontFamily: FONT, fontWeight: 600, fontSize: "10px", backgroundColor: "#F0EFEB", color: MUTED, borderRadius: "6px" }} />
                      )}
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
                        <Button
                          size="small"
                          startIcon={<VisibilityOutlined sx={{ fontSize: 15 }} />}
                          onClick={() => setActiveEmployee(emp)}
                          sx={{
                            textTransform: "none", fontFamily: FONT, fontSize: "12px", fontWeight: 600,
                            color: TEAL, borderRadius: "8px",
                            "&:hover": { backgroundColor: "rgba(22,24,29,0.08)" },
                          }}
                        >
                          View
                        </Button>
                        {isHR && isActive && (
                          <Tooltip title="Reset Password">
                            <IconButton
                              size="small"
                              onClick={() => setResetDialogTarget(emp)}
                              sx={{
                                color: MUTED, border: `1px solid ${BORDER}`, borderRadius: "8px", p: 0.6,
                                "&:hover": { color: INK, borderColor: INK, backgroundColor: "#FAF9F6" },
                              }}
                            >
                              <LockResetRounded sx={{ fontSize: 17 }} />
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

      {/* Status Change Dialog */}
      <Dialog
        open={Boolean(statusDialogTarget)}
        onClose={() => !statusUpdating && setStatusDialogTarget(null)}
        slotProps={{ paper: { sx: { borderRadius: "16px", p: 1, maxWidth: 440 } } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
          <Box
            sx={{
              width: 40, height: 40, borderRadius: "10px",
              backgroundColor: pendingNewStatus === "INACTIVE" ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
              color: pendingNewStatus === "INACTIVE" ? "#DC2626" : "#059669",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {pendingNewStatus === "INACTIVE" ? <WarningAmberRounded sx={{ fontSize: 24 }} /> : <CheckCircleOutlineRounded sx={{ fontSize: 24 }} />}
          </Box>
          <Typography sx={{ fontFamily: FONT, fontSize: "18px", fontWeight: 700, color: INK }}>
            {pendingNewStatus === "INACTIVE" ? "Deactivate Account?" : "Activate Account?"}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Typography sx={{ fontFamily: FONT, fontSize: "13px", color: MUTED, lineHeight: 1.6 }}>
            {pendingNewStatus === "INACTIVE" ? (
              <>Deactivating <strong style={{ color: INK }}>{statusDialogTarget?.first_name} {statusDialogTarget?.last_name}</strong> ({statusDialogTarget?.employee_code}) will immediately revoke their HRMS access and invalidate all active sessions.</>
            ) : (
              <>Activate <strong style={{ color: INK }}>{statusDialogTarget?.first_name} {statusDialogTarget?.last_name}</strong> ({statusDialogTarget?.employee_code})? A new temporary password will be generated and sent to <strong style={{ color: INK }}>{statusDialogTarget?.email}</strong>. For now, the formal email is printed in the backend terminal. They will be asked to change their password and complete their profile after logging in.</>
            )}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
          <Button onClick={() => setStatusDialogTarget(null)} disabled={statusUpdating} sx={{ textTransform: "none", fontFamily: FONT, fontWeight: 600, color: MUTED }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmStatusChange}
            disabled={statusUpdating}
            sx={{
              textTransform: "none", fontFamily: FONT, fontWeight: 600, borderRadius: "10px", px: 2.5,
              backgroundColor: pendingNewStatus === "INACTIVE" ? "#DC2626" : INK,
              "&:hover": { backgroundColor: pendingNewStatus === "INACTIVE" ? "#B91C1C" : "#2B2F38" },
            }}
          >
            {statusUpdating ? <CircularProgress size={18} sx={{ color: "#FFFFFF" }} /> : pendingNewStatus === "INACTIVE" ? "Yes, Deactivate" : "Yes, Activate"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog
        open={Boolean(resetDialogTarget)}
        onClose={() => !resettingPassword && setResetDialogTarget(null)}
        slotProps={{ paper: { sx: { borderRadius: "16px", p: 1, maxWidth: 440 } } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "rgba(22,24,29,0.08)", color: INK, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LockResetRounded sx={{ fontSize: 24 }} />
          </Box>
          <Typography sx={{ fontFamily: FONT, fontSize: "18px", fontWeight: 700, color: INK }}>Reset Password?</Typography>
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Typography sx={{ fontFamily: FONT, fontSize: "13px", color: MUTED, lineHeight: 1.6 }}>
            A temporary password will be generated for <strong style={{ color: INK }}>{resetDialogTarget?.first_name} {resetDialogTarget?.last_name}</strong> ({resetDialogTarget?.email}). Their current sessions will be terminated.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
          <Button onClick={() => setResetDialogTarget(null)} disabled={resettingPassword} sx={{ textTransform: "none", fontFamily: FONT, fontWeight: 600, color: MUTED }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmPasswordReset}
            disabled={resettingPassword}
            sx={{ textTransform: "none", fontFamily: FONT, fontWeight: 600, borderRadius: "10px", px: 2.5, backgroundColor: INK, "&:hover": { backgroundColor: "#2B2F38" } }}
          >
            {resettingPassword ? <CircularProgress size={18} sx={{ color: "#FFFFFF" }} /> : "Confirm Reset"}
          </Button>
        </DialogActions>
      </Dialog>

      <TablePagination
        component="div"
        count={filteredEmployees.length}
        page={Math.min(page, Math.max(0, Math.ceil(filteredEmployees.length / rowsPerPage) - 1))}
        onPageChange={(_, nextPage) => setPage(nextPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
        rowsPerPageOptions={[5, 10, 25, 50]}
        sx={{ fontFamily: FONT, borderBottom: `1px solid ${BORDER}` }}
      />

      {/* Profile Modal */}
      <EmployeeProfileModal
        open={Boolean(activeEmployee)}
        employee={activeEmployee}
        onClose={() => setActiveEmployee(null)}
        onSaved={fetchEmployees}
      />
    </AppLayout>
  );
}
