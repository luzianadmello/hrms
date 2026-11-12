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
  EditOutlined,
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
import { formatDate } from "../../utils/date";
import { useThemeMode } from "../../contexts/ThemeModeContext";
import type {
  EmployeeDetail,
  EmployeeStats,
  StatusChangeResponse,
} from "../../types/employee";

const FONT = "'Montserrat', sans-serif";

export default function EmployeeManagement() {
  const navigate = useNavigate();
  const { mode } = useThemeMode();
  const isDark = mode === "dark";
  const canCreate = can("user.create");
  const isHR = can("employee.update");

  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeDetail[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get("status") || "ALL");
  const [activeEmployee, setActiveEmployee] = useState<EmployeeDetail | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<"employee_code" | "date_of_joining">("employee_code");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [statusDialogTarget, setStatusDialogTarget] = useState<EmployeeDetail | null>(null);
  const [pendingNewStatus, setPendingNewStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [resetDialogTarget, setResetDialogTarget] = useState<EmployeeDetail | null>(null);
  const [editDialogTarget, setEditDialogTarget] = useState<EmployeeDetail | null>(null);
  const [editLookups, setEditLookups] = useState<{
    departments: { id: number; name: string }[];
    designations: { id: number; name: string }[];
    managers: { id: number; name: string }[];
  } | null>(null);
  const [editForm, setEditForm] = useState({
    department_id: "",
    designation_id: "",
    manager_id: "",
    employment_type: "FULL_TIME",
    date_of_joining: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [banner, setBanner] = useState<{ severity: "success" | "error"; message: string } | null>(null);

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
    else { setSortBy(column); setSortDirection("asc"); }
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
      await api.patch<StatusChangeResponse>(`/employees/${statusDialogTarget.employee_id}/status`, { status: pendingNewStatus });
      setBanner({
        severity: "success",
        message: pendingNewStatus === "ACTIVE"
          ? `Employee activated. Login details sent to ${statusDialogTarget.email}.`
          : "Employee deactivated. They have been signed out everywhere.",
      });
      setStatusDialogTarget(null);
      fetchEmployees();
      fetchStats();
    } catch (err: unknown) {
      setBanner({ severity: "error", message: getErrorMessage(err, "Failed to update status.") });
      setStatusDialogTarget(null);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleOpenEdit = async (employee: EmployeeDetail) => {
    setBanner(null);
    setEditDialogTarget(employee);
    setEditLookups(null);
    setEditForm({
      department_id: employee.department_id == null ? "" : String(employee.department_id),
      designation_id: employee.designation_id == null ? "" : String(employee.designation_id),
      manager_id: employee.manager_id == null ? "" : String(employee.manager_id),
      employment_type: employee.employment_type || "FULL_TIME",
      date_of_joining: employee.date_of_joining || "",
    });

    try {
      const response = await api.get<{
        departments: { id: number; name: string }[];
        designations: { id: number; name: string }[];
        managers: { id: number; name: string }[];
      }>("/employees/lookups");
      setEditLookups(response.data);
    } catch (err: unknown) {
      setEditDialogTarget(null);
      setBanner({ severity: "error", message: getErrorMessage(err, "Unable to load employee edit options.") });
    }
  };

  const handleSaveCompanyDetails = async () => {
    if (!editDialogTarget) return;
    if (!editForm.department_id || !editForm.designation_id || !editForm.date_of_joining) {
      setBanner({ severity: "error", message: "Department, designation, and joining date are required." });
      return;
    }
    setSavingEdit(true);
    setBanner(null);
    try {
      await api.put(`/employees/${editDialogTarget.employee_id}`, {
        department_id: Number(editForm.department_id),
        designation_id: Number(editForm.designation_id),
        manager_id: editForm.manager_id ? Number(editForm.manager_id) : null,
        employment_type: editForm.employment_type,
        date_of_joining: editForm.date_of_joining,
      });
      setEditDialogTarget(null);
      setBanner({ severity: "success", message: "Employee company details updated successfully." });
      await Promise.all([fetchEmployees(), fetchStats()]);
    } catch (err: unknown) {
      setBanner({ severity: "error", message: getErrorMessage(err, "Failed to update employee company details.") });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmPasswordReset = async () => {
    if (!resetDialogTarget) return;
    setResettingPassword(true);
    setBanner(null);
    try {
      const { data } = await api.post(`/employees/${resetDialogTarget.employee_id}/reset-password`);
      setBanner({ severity: "success", message: data.message || `Password reset successfully. Login details sent to ${resetDialogTarget.email}.` });
      setResetDialogTarget(null);
    } catch (err: unknown) {
      setBanner({ severity: "error", message: getErrorMessage(err, "Failed to reset password.") });
    } finally {
      setResettingPassword(false);
    }
  };

  // Shared dialog paper sx
  const dialogPaperSx = { borderRadius: "16px", p: 1, backgroundColor: "var(--hrms-surface)", color: "var(--hrms-text)" };

  return (
    <AppLayout pageTitle="Employees">
      {/* Page Header */}
      <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", flexDirection: { xs: "column", sm: "row" }, gap: 2, mb: 4 }}>
        <Box>
          <Typography sx={{ fontFamily: FONT, fontSize: "12px", fontWeight: 700, color: "var(--hrms-muted)", textTransform: "uppercase", letterSpacing: "0.8px", mb: 0.5 }}>
            Workforce Operations
          </Typography>
          <Typography component="h1" sx={{ fontFamily: FONT, fontSize: { xs: "22px", md: "26px" }, fontWeight: 700, color: "var(--hrms-text)", letterSpacing: "-0.6px" }}>
            Employees
          </Typography>
          <Typography sx={{ fontFamily: FONT, fontSize: "13px", color: "var(--hrms-muted)", mt: 0.4 }}>
            View, manage, and onboard employees across your organisation.
          </Typography>
        </Box>
        {canCreate && (
          <Button
            startIcon={<PersonAddAlt1Rounded />}
            onClick={() => navigate("/employees/create")}
            sx={{
              height: 44, px: 3, borderRadius: "10px",
              backgroundColor: "var(--hrms-btn-primary-bg)",
              color: "var(--hrms-btn-primary-text)",
              textTransform: "none", fontFamily: FONT, fontSize: "13px", fontWeight: 650, flexShrink: 0,
              boxShadow: "none",
              "&:hover": { backgroundColor: "var(--hrms-btn-primary-hover)", boxShadow: "none" },
            }}
          >
            Create Employee
          </Button>
        )}
      </Box>

      {/* Stats Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 2, mb: 4 }}>
        {[
          { icon: <GroupsOutlined sx={{ fontSize: 18 }} />, label: "Total Staff", value: stats?.total_employees, color: "var(--hrms-text)", bg: "var(--hrms-hover)" },
          { icon: <GroupsOutlined sx={{ fontSize: 18 }} />, label: "Active", value: stats?.active_employees, color: "#10b981", bg: "rgba(16,185,129,0.12)" },
          { icon: <GroupsOutlined sx={{ fontSize: 18 }} />, label: "Inactive", value: stats?.inactive_employees, color: "#f87171", bg: "rgba(239,68,68,0.12)" },
          { icon: <EventAvailableOutlined sx={{ fontSize: 18 }} />, label: "Profile incomplete", value: stats?.profile_incomplete, color: "#fbbf24", bg: "rgba(245,158,11,0.12)" },
        ].map((stat) => (
          <Box
            key={stat.label}
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: "16px",
              backgroundColor: "var(--hrms-surface)",
              border: "1px solid var(--hrms-border)",
              boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.2)" : "0 2px 8px rgba(0,0,0,0.03)",
              transition: "transform 0.15s ease",
              "&:hover": { transform: "translateY(-1px)" },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "9px", backgroundColor: stat.bg, color: stat.color, mb: 1.5 }}>
              {stat.icon}
            </Box>
            <Typography sx={{ fontFamily: FONT, fontSize: "11px", fontWeight: 600, color: "var(--hrms-muted)" }}>
              {stat.label}
            </Typography>
            {statsLoading ? (
              <CircularProgress size={18} sx={{ color: "var(--hrms-text)", mt: 0.5 }} />
            ) : (
              <Typography sx={{ fontFamily: FONT, fontSize: "26px", fontWeight: 700, color: stat.color, lineHeight: 1.2, mt: 0.3 }}>
                {stat.value ?? "—"}
              </Typography>
            )}
          </Box>
        ))}
      </Box>

      <ActionToast open={Boolean(banner)} severity={banner?.severity ?? "info"} message={banner?.message ?? ""} onClose={() => setBanner(null)} />

      {/* Filter Bar */}
      <Box
        sx={{
          backgroundColor: "var(--hrms-surface)",
          border: "1px solid var(--hrms-border)",
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
            slotProps={{ input: { startAdornment: (<InputAdornment position="start"><SearchRounded sx={{ color: "var(--hrms-muted)", fontSize: 20 }} /></InputAdornment>) } }}
            sx={{
              minWidth: { xs: "100%", sm: 280 },
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px", fontFamily: FONT, fontSize: "13px",
                backgroundColor: "var(--hrms-surface-alt)",
                "& fieldset": { borderColor: "var(--hrms-border)" },
                "&:hover fieldset": { borderColor: "var(--hrms-control-border)" },
                "&.Mui-focused fieldset": { borderColor: "var(--hrms-focus)" },
              },
            }}
          />
          <FormControl size="small" sx={{ minWidth: 160, "& .MuiOutlinedInput-root": { borderRadius: "10px", fontFamily: FONT, fontSize: "13px", backgroundColor: "var(--hrms-surface-alt)", "& fieldset": { borderColor: "var(--hrms-border)" } } }}>
            <Select value={selectedDept} onChange={(e) => { setSelectedDept(e.target.value); setPage(0); }} displayEmpty>
              <MenuItem value="ALL" sx={{ fontFamily: FONT, fontSize: "13px" }}>All Departments</MenuItem>
              {departments.map((dept) => <MenuItem key={dept} value={dept} sx={{ fontFamily: FONT, fontSize: "13px" }}>{dept}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160, "& .MuiOutlinedInput-root": { minHeight: 36, borderRadius: "10px", fontFamily: FONT, fontSize: "13px", backgroundColor: "var(--hrms-surface-alt)", "& fieldset": { borderColor: "var(--hrms-border)" }, "&:hover fieldset": { borderColor: "var(--hrms-control-border)" }, "&.Mui-focused fieldset": { borderColor: "var(--hrms-focus)", borderWidth: 1.5 } }, "& .MuiSelect-select": { py: "8px", pr: "32px !important" }, "& .MuiSelect-icon": { color: "var(--hrms-muted)", right: 8 } }}>
            <Select value={selectedStatus} onChange={(e) => { setSelectedStatus(e.target.value); setPage(0); }} displayEmpty>
              <MenuItem value="ALL" sx={{ fontFamily: FONT, fontSize: "13px" }}>All Status</MenuItem>
              <MenuItem value="ACTIVE" sx={{ fontFamily: FONT, fontSize: "13px" }}>Active</MenuItem>
              <MenuItem value="INACTIVE" sx={{ fontFamily: FONT, fontSize: "13px" }}>Inactive</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Tooltip title="Refresh list">
          <IconButton onClick={fetchEmployees} disabled={listLoading} sx={{ border: "1px solid var(--hrms-border)", borderRadius: "10px", color: "var(--hrms-text)", "&:hover": { backgroundColor: "var(--hrms-hover)" } }}>
            <RefreshRounded sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Employee Table */}
      <TableContainer sx={{ backgroundColor: "var(--hrms-surface)", border: "1px solid var(--hrms-border)", borderRadius: "16px", overflow: "hidden" }}>
        <Table sx={{ minWidth: 800 }}>
          <TableHead sx={{ backgroundColor: "var(--hrms-surface-alt)" }}>
            <TableRow>
              {["EMPLOYEE", "CODE", "DEPARTMENT & ROLE", "JOINING DATE", "STATUS", "PROFILE", "ACTIONS"].map((col, i) => (
                <TableCell
                  key={col}
                  align={i === 6 ? "right" : "left"}
                  sortDirection={(i === 1 && sortBy === "employee_code") || (i === 3 && sortBy === "date_of_joining") ? sortDirection : false}
                  sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "12px", color: "var(--hrms-muted)", borderBottomColor: "var(--hrms-border)" }}
                >
                  {i === 1 || i === 3 ? (
                    <TableSortLabel
                      active={(i === 1 && sortBy === "employee_code") || (i === 3 && sortBy === "date_of_joining")}
                      direction={i === 1 ? (sortBy === "employee_code" ? sortDirection : "asc") : (sortBy === "date_of_joining" ? sortDirection : "asc")}
                      onClick={() => handleSort(i === 1 ? "employee_code" : "date_of_joining")}
                      IconComponent={ArrowDropDownRounded}
                      sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "12px", color: "var(--hrms-muted)", flexDirection: "row", alignItems: "center", gap: "3px", "& .MuiTableSortLabel-icon": { margin: 0, opacity: 1, color: `var(--hrms-muted) !important`, transform: ((i === 1 && sortBy === "employee_code") || (i === 3 && sortBy === "date_of_joining") ? sortDirection : "asc") === "asc" ? "rotate(0deg) !important" : "rotate(180deg) !important" } }}
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
                <TableCell colSpan={7} align="center" sx={{ py: 6, borderBottomColor: "var(--hrms-border)" }}>
                  <CircularProgress size={28} sx={{ color: "var(--hrms-text)", mb: 1 }} />
                  <Typography sx={{ fontFamily: FONT, color: "var(--hrms-muted)", fontSize: "13px" }}>
                    Loading employee records…
                  </Typography>
                </TableCell>
              </TableRow>
            ) : filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, borderBottomColor: "var(--hrms-border)" }}>
                  <Typography sx={{ fontFamily: FONT, color: "var(--hrms-muted)", fontSize: "14px", fontWeight: 600 }}>No employees found.</Typography>
                  <Typography sx={{ fontFamily: FONT, color: "var(--hrms-muted)", fontSize: "12px", mt: 0.5 }}>Try adjusting your search or filters.</Typography>
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
                    sx={{ cursor: "pointer", "&:hover": { backgroundColor: "var(--hrms-hover)" }, "& td": { borderBottomColor: "var(--hrms-border-subtle)" } }}
                    onClick={() => setActiveEmployee(emp)}
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar sx={{ width: 38, height: 38, bgcolor: "var(--hrms-hover)", color: "var(--hrms-text)", fontFamily: FONT, fontSize: "13px", fontWeight: 700, border: "1px solid var(--hrms-border)" }}>
                          {initials}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontFamily: FONT, fontSize: "13px", fontWeight: 700, color: "var(--hrms-text)" }}>{fullName}</Typography>
                          <Typography sx={{ fontFamily: FONT, fontSize: "11px", color: "var(--hrms-muted)" }}>{emp.email}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={emp.employee_code} size="small" sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "11px", backgroundColor: "var(--hrms-surface-alt)", color: "var(--hrms-text)", borderRadius: "6px", border: "1px solid var(--hrms-border)" }} />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontFamily: FONT, fontSize: "13px", fontWeight: 600, color: "var(--hrms-text)" }}>{emp.department_name || "—"}</Typography>
                      <Typography sx={{ fontFamily: FONT, fontSize: "11px", color: "var(--hrms-muted)" }}>{emp.designation_name || emp.role_name || "—"}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontFamily: FONT, fontSize: "12px", color: "var(--hrms-text)" }}>{formatDate(emp.date_of_joining)}</Typography>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {isHR ? (
                        <Tooltip title={isActive ? "Click to deactivate" : "Click to activate"}>
                          <span>
                            <StatusChip status={emp.status} onClick={() => handleInitiateStatusChange(emp, isActive ? "INACTIVE" : "ACTIVE")} />
                          </span>
                        </Tooltip>
                      ) : (
                        <StatusChip status={emp.status} />
                      )}
                    </TableCell>
                    <TableCell>
                      {emp.profile_completed ? (
                        <Chip label="Complete" size="small" sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "10px", backgroundColor: isDark ? "rgba(16,185,129,0.16)" : "rgba(16,185,129,0.10)", color: isDark ? "#34D399 !important" : "#059669 !important", border: isDark ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(16,185,129,0.2)", borderRadius: "6px" }} />
                      ) : (
                        <Chip label="Pending" size="small" sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "10px", backgroundColor: isDark ? "rgba(245,158,11,0.16)" : "rgba(245,158,11,0.10)", color: isDark ? "#FBBF24 !important" : "#D97706 !important", border: isDark ? "1px solid rgba(251,191,36,0.3)" : "1px solid rgba(245,158,11,0.2)", borderRadius: "6px" }} />
                      )}
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
                        <Button
                          size="small"
                          startIcon={<VisibilityOutlined sx={{ fontSize: 15 }} />}
                          onClick={() => setActiveEmployee(emp)}
                          sx={{
                            textTransform: "none",
                            fontFamily: FONT,
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "var(--hrms-text)",
                            backgroundColor: "var(--hrms-surface-alt)",
                            border: "1px solid var(--hrms-border)",
                            borderRadius: "8px",
                            px: 1.5,
                            py: 0.5,
                            "&:hover": {
                              backgroundColor: "var(--hrms-hover)",
                              borderColor: "var(--hrms-control-border)",
                            },
                          }}
                        >
                          View
                        </Button>
                        {isHR && (
                          <Tooltip title="Edit company details">
                            <IconButton size="small" onClick={() => handleOpenEdit(emp)} sx={{ color: "var(--hrms-muted)", backgroundColor: "var(--hrms-surface-alt)", border: "1px solid var(--hrms-border)", borderRadius: "8px", p: 0.6, "&:hover": { color: "var(--hrms-text)", borderColor: "var(--hrms-control-border)", backgroundColor: "var(--hrms-hover)" } }}>
                              <EditOutlined sx={{ fontSize: 17 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {isHR && isActive && (
                          <Tooltip title="Reset Password">
                            <IconButton size="small" onClick={() => setResetDialogTarget(emp)} sx={{ color: "var(--hrms-muted)", backgroundColor: "var(--hrms-surface-alt)", border: "1px solid var(--hrms-border)", borderRadius: "8px", p: 0.6, "&:hover": { color: "var(--hrms-text)", borderColor: "var(--hrms-control-border)", backgroundColor: "var(--hrms-hover)" } }}>
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

      {/* Edit Dialog */}
      <Dialog open={Boolean(editDialogTarget)} onClose={() => !savingEdit && setEditDialogTarget(null)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { ...dialogPaperSx } } }}>
        <DialogTitle sx={{ fontFamily: FONT, fontSize: "18px", fontWeight: 700, color: "var(--hrms-text)", backgroundColor: "var(--hrms-surface)" }}>Edit Company Details</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important", backgroundColor: "var(--hrms-surface)", color: "var(--hrms-text)" }}>
          <Typography sx={{ fontFamily: FONT, fontSize: "13px", color: "var(--hrms-muted)", lineHeight: 1.6 }}>
            Update only the employee's company-assigned details.
          </Typography>
          {!editLookups ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={24} sx={{ color: "var(--hrms-text)" }} />
            </Box>
          ) : (
            <>
              {[
                { label: "Department *", field: "department_id" as const, items: editLookups.departments, placeholder: "Select department" },
                { label: "Designation *", field: "designation_id" as const, items: editLookups.designations, placeholder: "Select designation" },
              ].map(({ label, field, items, placeholder }) => (
                <Box key={field}>
                  <Typography sx={{ fontFamily: FONT, fontSize: "12px", fontWeight: 600, color: "var(--hrms-text)", mb: 0.6 }}>{label}</Typography>
                  <FormControl fullWidth size="small">
                    <Select value={editForm[field]} onChange={(event) => setEditForm((form) => ({ ...form, [field]: event.target.value }))} displayEmpty sx={{ fontFamily: FONT, fontSize: "13px", borderRadius: "10px" }}>
                      <MenuItem value="" disabled>{placeholder}</MenuItem>
                      {items.map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Box>
              ))}
              <Box>
                <Typography sx={{ fontFamily: FONT, fontSize: "12px", fontWeight: 600, color: "var(--hrms-text)", mb: 0.6 }}>Reporting Manager</Typography>
                <FormControl fullWidth size="small">
                  <Select value={editForm.manager_id} onChange={(event) => setEditForm((form) => ({ ...form, manager_id: event.target.value }))} displayEmpty sx={{ fontFamily: FONT, fontSize: "13px", borderRadius: "10px" }}>
                    <MenuItem value="">No reporting manager</MenuItem>
                    {editLookups.managers.filter((item) => item.id !== editDialogTarget?.employee_id).map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <Typography sx={{ fontFamily: FONT, fontSize: "12px", fontWeight: 600, color: "var(--hrms-text)", mb: 0.6 }}>Employment Type *</Typography>
                <FormControl fullWidth size="small">
                  <Select value={editForm.employment_type} onChange={(event) => setEditForm((form) => ({ ...form, employment_type: event.target.value }))} sx={{ fontFamily: FONT, fontSize: "13px", borderRadius: "10px" }}>
                    {[["FULL_TIME", "Full Time"], ["PART_TIME", "Part Time"], ["CONTRACT", "Contract"], ["INTERN", "Intern"]].map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <Typography sx={{ fontFamily: FONT, fontSize: "12px", fontWeight: 600, color: "var(--hrms-text)", mb: 0.6 }}>Date of Joining *</Typography>
                <TextField fullWidth size="small" type="date" value={editForm.date_of_joining} onChange={(event) => setEditForm((form) => ({ ...form, date_of_joining: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", fontFamily: FONT, fontSize: "13px" } }} />
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, backgroundColor: "var(--hrms-surface)" }}>
          <Button onClick={() => setEditDialogTarget(null)} disabled={savingEdit} sx={{ textTransform: "none", fontFamily: FONT, color: "var(--hrms-muted)" }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveCompanyDetails} disabled={savingEdit || !editLookups} sx={{ textTransform: "none", fontFamily: FONT, fontWeight: 650, borderRadius: "10px", px: 2.5, backgroundColor: "var(--hrms-btn-primary-bg)", color: "var(--hrms-btn-primary-text)", "&:hover": { backgroundColor: "var(--hrms-btn-primary-hover)" } }}>
            {savingEdit ? <CircularProgress size={18} sx={{ color: "var(--hrms-btn-primary-text)" }} /> : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={Boolean(statusDialogTarget)} onClose={() => !statusUpdating && setStatusDialogTarget(null)} slotProps={{ paper: { sx: { ...dialogPaperSx, maxWidth: 440 } } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1, backgroundColor: "var(--hrms-surface)", color: "var(--hrms-text)" }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: pendingNewStatus === "INACTIVE" ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)", color: pendingNewStatus === "INACTIVE" ? "#f87171" : "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {pendingNewStatus === "INACTIVE" ? <WarningAmberRounded sx={{ fontSize: 24 }} /> : <CheckCircleOutlineRounded sx={{ fontSize: 24 }} />}
          </Box>
          <Typography sx={{ fontFamily: FONT, fontSize: "18px", fontWeight: 700, color: "var(--hrms-text)" }}>
            {pendingNewStatus === "INACTIVE" ? "Deactivate Account?" : "Activate Account?"}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ py: 1, backgroundColor: "var(--hrms-surface)" }}>
          <Typography sx={{ fontFamily: FONT, fontSize: "13px", color: "var(--hrms-muted)", lineHeight: 1.6 }}>
            {pendingNewStatus === "INACTIVE" ? (
              <>Deactivating <strong style={{ color: "var(--hrms-text)" }}>{statusDialogTarget?.first_name} {statusDialogTarget?.last_name}</strong> ({statusDialogTarget?.employee_code}) will immediately revoke their HRMS access.</>
            ) : (
              <>Activate <strong style={{ color: "var(--hrms-text)" }}>{statusDialogTarget?.first_name} {statusDialogTarget?.last_name}</strong> ({statusDialogTarget?.employee_code})? A new temporary password will be sent to <strong style={{ color: "var(--hrms-text)" }}>{statusDialogTarget?.email}</strong>.</>
            )}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1, backgroundColor: "var(--hrms-surface)" }}>
          <Button onClick={() => setStatusDialogTarget(null)} disabled={statusUpdating} sx={{ textTransform: "none", fontFamily: FONT, fontWeight: 600, color: "var(--hrms-muted)" }}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmStatusChange} disabled={statusUpdating} sx={{ textTransform: "none", fontFamily: FONT, fontWeight: 650, borderRadius: "10px", px: 2.5, backgroundColor: pendingNewStatus === "INACTIVE" ? "#DC2626" : "var(--hrms-btn-primary-bg)", color: pendingNewStatus === "INACTIVE" ? "#FFF" : "var(--hrms-btn-primary-text)", "&:hover": { backgroundColor: pendingNewStatus === "INACTIVE" ? "#B91C1C" : "var(--hrms-btn-primary-hover)" } }}>
            {statusUpdating ? <CircularProgress size={18} sx={{ color: "#FFFFFF" }} /> : pendingNewStatus === "INACTIVE" ? "Yes, Deactivate" : "Yes, Activate"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={Boolean(resetDialogTarget)} onClose={() => !resettingPassword && setResetDialogTarget(null)} slotProps={{ paper: { sx: { ...dialogPaperSx, maxWidth: 440 } } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1, backgroundColor: "var(--hrms-surface)", color: "var(--hrms-text)" }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", backgroundColor: "var(--hrms-hover)", color: "var(--hrms-text)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LockResetRounded sx={{ fontSize: 24 }} />
          </Box>
          <Typography sx={{ fontFamily: FONT, fontSize: "18px", fontWeight: 700, color: "var(--hrms-text)" }}>Reset Password?</Typography>
        </DialogTitle>
        <DialogContent sx={{ py: 1, backgroundColor: "var(--hrms-surface)" }}>
          <Typography sx={{ fontFamily: FONT, fontSize: "13px", color: "var(--hrms-muted)", lineHeight: 1.6 }}>
            A temporary password will be generated for <strong style={{ color: "var(--hrms-text)" }}>{resetDialogTarget?.first_name} {resetDialogTarget?.last_name}</strong> ({resetDialogTarget?.email}). Their current sessions will be terminated.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1, backgroundColor: "var(--hrms-surface)" }}>
          <Button onClick={() => setResetDialogTarget(null)} disabled={resettingPassword} sx={{ textTransform: "none", fontFamily: FONT, fontWeight: 600, color: "var(--hrms-muted)" }}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmPasswordReset} disabled={resettingPassword} sx={{ textTransform: "none", fontFamily: FONT, fontWeight: 650, borderRadius: "10px", px: 2.5, backgroundColor: "var(--hrms-btn-primary-bg)", color: "var(--hrms-btn-primary-text)", "&:hover": { backgroundColor: "var(--hrms-btn-primary-hover)" } }}>
            {resettingPassword ? <CircularProgress size={18} sx={{ color: "var(--hrms-btn-primary-text)" }} /> : "Confirm Reset"}
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
        sx={{ fontFamily: FONT, borderTop: "1px solid var(--hrms-border)", backgroundColor: "var(--hrms-surface)", color: "var(--hrms-text)" }}
      />

      {/* Profile Modal */}
      <EmployeeProfileModal open={Boolean(activeEmployee)} employee={activeEmployee} onClose={() => setActiveEmployee(null)} onSaved={fetchEmployees} />
    </AppLayout>
  );
}
