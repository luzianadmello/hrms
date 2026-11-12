import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControl, IconButton, InputLabel, MenuItem,
  Paper, Select, Stack, TextField, Tooltip, Typography, TablePagination,
} from "@mui/material";
import {
  AccessTimeRounded, ArrowBackIosNewRounded, ArrowForwardIosRounded,
  CalendarMonthRounded, CheckCircleRounded, DownloadRounded, EventBusyRounded,
  SettingsRounded, TableRowsRounded, ViewWeekRounded,
  CalendarViewMonthRounded, FilterListRounded, EditOutlined, PowerSettingsNewRounded,
} from "@mui/icons-material";
import AppLayout from "../../components/layout/AppLayout";
import { useLocation, useNavigate } from "react-router-dom";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import api from "../../services/api";
import { canAny } from "../../utils/permissions";

const FONT = "'Montserrat', sans-serif";
const INK = "#17191F";
const MUTED = "#555B65";
const BORDER = "#E4E3DF";

type DayStatus = "PRESENT" | "HALF_DAY" | "ABSENT" | "ACTIVE" | "INCOMPLETE" | "WEEKEND" | "HOLIDAY" | "LEAVE" | "YET_TO_CHECK_IN" | null;
type Flag = "LATE" | "EARLY_LEAVE" | "MISSED_CHECKOUT";
type CorrectionType = "MISSED_CHECKOUT" | "WRONG_TIME" | "MANUAL_ENTRY";
interface AttendanceDay {
  date: string; weekday: string; status: DayStatus; check_in_time: string | null;
  check_out_time: string | null; worked_minutes: number | null; overtime_minutes: number;
  flags: Flag[]; correction_type: CorrectionType | null;
  leave_type_name?: string | null; leave_days?: number | null; holiday_name?: string | null;
}
interface MyAttendance {
  server_time: string; today: string; state: "NOT_CHECKED_IN" | "CHECKED_IN" | "CHECKED_OUT" | "NON_WORKING";
  can_check_in: boolean; can_check_out: boolean; yesterday_checkout_missing: boolean;
  missed_checkout_dates: string[]; days: AttendanceDay[];
}
interface Policy {
  policy_id: number; name: string; effective_from: string; status: "PAST" | "CURRENT" | "UPCOMING" | "INACTIVE"; is_active?: boolean;
  shift_start: string; shift_end: string; grace_in_minutes: number; grace_out_minutes: number;
  full_day_hours: number; half_day_hours: number; overtime_min_minutes: number;
  overtime_buffer_hours: number; weekly_offs: string[];
}
interface PolicyOverview { today: string; current: Policy; upcoming: Policy[]; past: Policy[]; inactive: Policy[]; }
interface ReportCell {
  date: string; status: DayStatus; check_in_time: string | null; check_out_time: string | null;
  worked_minutes: number | null; overtime_minutes: number; flags: Flag[];
  missed_checkout_pending: boolean; correction_type: CorrectionType | null;
}
interface ReportRow {
  employee_id: number; employee_code: string; employee_name: string; department_name: string | null;
  cells: ReportCell[];
  totals: { present_days: number; half_days: number; absent_days: number; late_count: number;
    early_leave_count: number; missed_checkout_count: number; overtime_minutes: number; worked_minutes: number; };
}
interface DepartmentOption { id: number; name: string; }
interface AttendanceReport {
  from_date: string; to_date: string; today: string;
  summary: { date: string; total: number; present: number; half_day: number; absent: number;
    late: number; early_leave: number; missed_checkout: number; overtime: number;
    yet_to_check_in: number; not_working: number; };
  period_summary: { employees: number; scheduled_days: number; present_days: number; short_days: number;
    no_record_days: number; late_count: number; early_leave_count: number; needs_action: number;
    overtime_minutes: number; worked_minutes: number; attendance_rate: number; };
  daily_trend: { date: string; attendance_rate: number; present: number; short_days: number; late: number; }[];
  department_summary: { department: string; scheduled_days: number; present_days: number; short_days: number;
    no_record_days: number; late_count: number; needs_action: number; attendance_rate: number; }[];
  page: number; page_size: number; total: number; total_pages: number; days: string[]; rows: ReportRow[];
}
const todayISO = () => {
  // Used only to initialize date filters; server time is authoritative for check-in state.
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
};
const currentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};
const monthStart = (month: string) => `${month}-01`;
const monthEnd = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return dateParam(new Date(year, monthNumber, 0, 12));
};
const shiftMonth = (month: string, delta: number) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1, 12).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};
const fmtTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(new Date(value))
  : "—";
const fmtHours = (minutes?: number | null) => minutes == null ? "—" : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
const fmtDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const dateParam = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const addDays = (value: string, days: number) => { const d = new Date(`${value}T12:00:00`); d.setDate(d.getDate() + days); return dateParam(d); };
const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present", HALF_DAY: "Half day", ABSENT: "Absent", ACTIVE: "Present", INCOMPLETE: "Incomplete",
  WEEKEND: "Weekly off", HOLIDAY: "Holiday", LEAVE: "On leave", YET_TO_CHECK_IN: "Yet to check in",
  LATE: "Late", EARLY_LEAVE: "Early leave", MISSED_CHECKOUT: "Missing check-out",
};
const statusLabel = (status: string | null) => STATUS_LABELS[status || ""] || "No record";
function StatusChip({ status }: { status: string | null }) {
  const color = status === "PRESENT" || status === "ACTIVE" ? "#16845B"
    : status === "ABSENT" ? "#C53B4B"
    : status === "LEAVE" || status === "HALF_DAY" ? "#B77908"
    : status === "WEEKEND" ? "#2769C7"
    : status === "HOLIDAY" ? "#8A6D1D" : "#64748B";
  return <Chip size="small" label={statusLabel(status)} sx={{ fontFamily: FONT, fontWeight: 600, fontSize: 11, borderRadius: "7px", color, bgcolor: `${color}12`, border: `1px solid ${color}26` }} />;
}
function SectionTitle({ title, subtitle, icon }: { title: string; subtitle: string; icon: ReactNode }) {
  return <Stack direction="row" spacing={1.5} sx={{ mb: 2.2, alignItems: "center" }}>
    <Box sx={{ width: 40, height: 40, borderRadius: "11px", bgcolor: "#F0F2F5", color: INK, display: "grid", placeItems: "center" }}>{icon}</Box>
    <Box><Typography sx={{ fontFamily: FONT, fontWeight: 700, fontSize: 17, color: INK }}>{title}</Typography>
      <Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 12 }}>{subtitle}</Typography></Box>
  </Stack>;
}
function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <Paper variant="outlined" sx={{ p: 2, borderRadius: "13px", borderColor: BORDER, boxShadow: "none", minWidth: 0 }}>
    <Typography sx={{ fontFamily: FONT, fontSize: 12, color: MUTED, mb: 1, fontWeight: 600 }}>{label}</Typography>
    <Typography sx={{ fontFamily: FONT, fontSize: 25, lineHeight: 1.2, fontWeight: 700, color: INK }}>{value}</Typography>
    {note && <Typography sx={{ fontFamily: FONT, fontSize: 11, color: MUTED, mt: .7, fontWeight: 500 }}>{note}</Typography>}
  </Paper>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <Box sx={{ minWidth: 0 }}><Typography sx={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: "#454951", mb: .8 }}>{label}</Typography>{children}</Box>;
}
const inputSx = { "& .MuiInputBase-root": { fontFamily: FONT, borderRadius: "9px", bgcolor: "#fff", fontSize: 13 }, "& .MuiInputLabel-root": { fontFamily: FONT } };

export default function AttendancePage() {
  const canViewOwn = canAny("attendance.view_own");
  const canMark = canAny("attendance.mark");
  const canViewAll = canAny("attendance.view_all");
  const canCorrect = canAny("attendance.correct");
  const canViewPolicy = canAny("attendance.view_policy");
  const canUpdatePolicy = canAny("attendance.update_policy");
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname.endsWith("/employees") ? "team"
    : location.pathname.endsWith("/reports") ? "reports"
    : location.pathname.endsWith("/settings") ? "settings" : "mine";
  const tabs = useMemo(() => [
    ...(canViewOwn ? ["mine"] : []),
    ...(canViewAll ? ["team", "reports"] : []),
    ...(canViewPolicy ? ["settings"] : []),
  ], [canViewOwn, canViewAll, canViewPolicy]);
  const [mine, setMine] = useState<MyAttendance | null>(null);
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [policy, setPolicy] = useState<PolicyOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue());
  const [teamDate, setTeamDate] = useState(todayISO());
  const [teamMonth, setTeamMonth] = useState(currentMonthValue());
  const [teamView, setTeamView] = useState<"daily" | "week" | "calendar">("daily");
  const [myView, setMyView] = useState<"table" | "timeline" | "calendar">("table");
  const [myStatusFilter, setMyStatusFilter] = useState("ALL");
  const [myRecordsPage, setMyRecordsPage] = useState(1);
  const [myRecordsPageSize, setMyRecordsPageSize] = useState(8);
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(1); return dateParam(d); });
  const [toDate, setToDate] = useState(todayISO());
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const loadedTabsRef = useRef<Record<string, boolean>>({});
  const [editTarget, setEditTarget] = useState<{ employeeId: number; employeeName: string; date: string; cell: ReportCell } | null>(null);
  const [editIn, setEditIn] = useState("");
  const [editOut, setEditOut] = useState("");
  const [correctionType, setCorrectionType] = useState<CorrectionType>("MISSED_CHECKOUT");
  const [clearDay, setClearDay] = useState(false);
  const [policyDraft, setPolicyDraft] = useState<Partial<Policy>>({});
  const [policyEffectiveFrom, setPolicyEffectiveFrom] = useState("");
  const [editingPolicyId, setEditingPolicyId] = useState<number | null>(null);
  const [activationTarget, setActivationTarget] = useState<Policy | null>(null);
  const [activationDate, setActivationDate] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionScope, setCorrectionScope] = useState<"CHECK_IN" | "CHECK_OUT" | "BOTH">("BOTH");

  useEffect(() => {
    if (!canViewAll) return;
    api.get<DepartmentOption[]>("/organization/departments")
      .then((res) => setDepartments(res.data))
      .catch(() => setDepartments([]));
  }, [canViewAll]);

  // Employee search behaves like Employee Management: matching records update as the user types.
  useEffect(() => {
    if (activeTab !== "team" && activeTab !== "reports") return;
    const handle = window.setTimeout(() => {
      setPage(1);
      setAppliedQuery(query.trim());
    }, 400);
    return () => window.clearTimeout(handle);
  }, [query, activeTab]);

  const loadMine = useCallback(async () => {
    const res = await api.get<MyAttendance>("/attendance/me", { params: { from: monthStart(selectedMonth), to: monthEnd(selectedMonth) } });
    setMine(res.data);
  }, [selectedMonth]);
  const loadReport = useCallback(async (nextPage = page) => {
    let from = fromDate;
    let to = toDate;
    let onDate = teamDate;
    if (activeTab === "team") {
      if (teamView === "calendar") {
        from = monthStart(teamMonth);
        to = monthEnd(teamMonth);
      } else if (teamView === "week") {
        const picked = new Date(`${teamDate}T12:00:00`);
        const mondayOffset = (picked.getDay() + 6) % 7;
        from = addDays(teamDate, -mondayOffset);
        to = addDays(from, 6);
      } else {
        from = teamDate;
        to = teamDate;
      }
    }
    const params: Record<string, string | number> = { from, to, date: onDate, page: nextPage, page_size: pageSize };
    if (appliedQuery.trim()) params.q = appliedQuery.trim();
    if (departmentId) params.department_id = departmentId;
    if (status && (activeTab === "reports" || teamView === "daily")) params.status = status;
    const res = await api.get<AttendanceReport>("/attendance/report", { params });
    if (activeTab === "team" && teamView === "calendar" && res.data.total_pages > 1) {
      const remaining = await Promise.all(
        Array.from({ length: res.data.total_pages - 1 }, (_, index) =>
          api.get<AttendanceReport>("/attendance/report", { params: { ...params, page: index + 2 } }),
        ),
      );
      setReport({
        ...res.data,
        rows: [...res.data.rows, ...remaining.flatMap(item => item.data.rows)],
        page: 1,
        page_size: res.data.total,
        total_pages: 1,
      });
    } else {
      setReport(res.data);
    }
  }, [activeTab, fromDate, toDate, teamDate, teamMonth, teamView, page, pageSize, appliedQuery, departmentId, status]);
  const loadPolicy = useCallback(async () => {
    const res = await api.get<PolicyOverview>("/attendance/settings");
    setPolicy(res.data);
    setPolicyDraft(res.data.current);
  }, []);
  const refreshCurrent = useCallback(async () => {
    if (!loadedTabsRef.current[activeTab]) setLoading(true);
    setError("");
    try {
      if (activeTab === "mine") await loadMine();
      if (activeTab === "team" || activeTab === "reports") await loadReport(page);
      if (activeTab === "settings") await loadPolicy();
      loadedTabsRef.current[activeTab] = true;
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not load attendance data. Please try again.");
    } finally { setLoading(false); }
  }, [activeTab, loadMine, loadReport, loadPolicy, page]);
  useEffect(() => {
    if (!tabs.length) return;
    const allowed = (activeTab === "mine" && canViewOwn)
      || (activeTab === "team" && canViewAll)
      || (activeTab === "reports" && canViewAll)
      || (activeTab === "settings" && canViewPolicy);
    if (!allowed) navigate(activeTab === "team" || activeTab === "reports" ? "/attendance/employees" : canViewOwn ? "/attendance/my-attendance" : canViewAll ? "/attendance/employees" : "/attendance/settings", { replace: true });
  }, [activeTab, tabs, canViewOwn, canViewAll, canViewPolicy, navigate]);
  useEffect(() => { void refreshCurrent(); }, [refreshCurrent]);

  const doPunch = async (action: "check-in" | "check-out") => {
    setActionBusy(true); setError(""); setNotice("");
    try {
      await api.post(`/attendance/${action}`);
      setNotice(action === "check-in" ? "Checked in successfully." : "Checked out successfully.");
      if (selectedMonth !== currentMonthValue()) setSelectedMonth(currentMonthValue());
      else await loadMine();
    } catch (e: any) { setError(e?.response?.data?.detail || "Attendance action failed. Please try again."); }
    finally { setActionBusy(false); }
  };
  const downloadCsv = async (totals = false) => {
    try {
      let exportFrom = fromDate;
      let exportTo = toDate;
      if (activeTab === "team") {
        if (teamView === "calendar") { exportFrom = monthStart(teamMonth); exportTo = monthEnd(teamMonth); }
        else if (teamView === "week") { const picked = new Date(`${teamDate}T12:00:00`); const start = addDays(teamDate, -((picked.getDay() + 6) % 7)); exportFrom = start; exportTo = addDays(start, 6); }
        else { exportFrom = teamDate; exportTo = teamDate; }
      }
      const res = await api.get("/attendance/report", { params: { from: exportFrom, to: exportTo, date: activeTab === "team" ? teamDate : undefined, q: query.trim() || undefined, department_id: departmentId || undefined, status: status || undefined, format: totals ? "totals_csv" : "csv" }, responseType: "blob" });
      const url = URL.createObjectURL(res.data); const a = document.createElement("a");
      a.href = url; a.download = totals ? "attendance-totals.csv" : "attendance-report.csv"; a.click(); URL.revokeObjectURL(url);
    } catch (e: any) { setError(e?.response?.data?.detail || "Could not export the report."); }
  };
  const openCorrection = (row: ReportRow, cell: ReportCell) => {
    setEditTarget({ employeeId: row.employee_id, employeeName: row.employee_name, date: cell.date, cell });
    setEditIn("");
    setEditOut("");
    setCorrectionType(cell.missed_checkout_pending ? "MISSED_CHECKOUT" : "WRONG_TIME");
    setCorrectionScope(cell.missed_checkout_pending ? "CHECK_OUT" : "BOTH");
    setCorrectionReason("");
    setClearDay(false);
  };
  const saveCorrection = async () => {
    if (!editTarget) return;
    if (!clearDay && correctionType === "MISSED_CHECKOUT" && !editOut) { setError("Enter the actual check-out time."); return; }
    if (!clearDay && correctionType !== "MISSED_CHECKOUT" && ((correctionScope === "CHECK_IN" && !editIn) || (correctionScope === "CHECK_OUT" && !editOut) || (correctionScope === "BOTH" && (!editIn || !editOut)))) { setError("Enter the corrected time field(s) you selected."); return; }
    setActionBusy(true); setError(""); setNotice("");
    try {
      const payload: Record<string, unknown> = clearDay ? { clear: true } : {
        correction_type: correctionType,
        ...(correctionReason.trim() ? { reason: correctionReason.trim() } : {}),
        ...((correctionType !== "MISSED_CHECKOUT" && (correctionScope === "CHECK_IN" || correctionScope === "BOTH") && editIn) ? { check_in_time: editIn } : {}),
        ...((correctionScope === "CHECK_OUT" || correctionScope === "BOTH" || correctionType === "MISSED_CHECKOUT") && editOut ? { check_out_time: editOut } : {}),
      };
      await api.put(`/attendance/${editTarget.employeeId}/${editTarget.date}`, payload);
      setEditTarget(null); setNotice(`Attendance updated for ${editTarget.employeeName}.`); await loadReport(page);
    } catch (e: any) { setError(e?.response?.data?.detail || "Could not save the attendance correction."); }
    finally { setActionBusy(false); }
  };
  const savePolicy = async () => {
    if (!policyDraft) return;
    setActionBusy(true); setError(""); setNotice("");
    try {
      const payload = {
        name: policyDraft.name, effective_from: policyEffectiveFrom || undefined, shift_start: policyDraft.shift_start, shift_end: policyDraft.shift_end,
        grace_in_minutes: Number(policyDraft.grace_in_minutes), grace_out_minutes: Number(policyDraft.grace_out_minutes),
        full_day_hours: Number(policyDraft.full_day_hours), half_day_hours: Number(policyDraft.half_day_hours),
        overtime_min_minutes: Number(policyDraft.overtime_min_minutes), overtime_buffer_hours: Number(policyDraft.overtime_buffer_hours),
        weekly_offs: policyDraft.weekly_offs || [],
      };
      const res = editingPolicyId
        ? await api.patch<PolicyOverview>(`/attendance/settings/${editingPolicyId}`, payload)
        : await api.put<PolicyOverview>("/attendance/settings", payload);
      setPolicy(res.data); setPolicyDraft(res.data.current); setPolicyEffectiveFrom(addDays(res.data.today, 1)); setEditingPolicyId(null);
      setNotice(editingPolicyId ? "Policy updated successfully." : "New policy version created successfully.");
    } catch (e: any) { setError(e?.response?.data?.detail || "Could not save attendance settings."); }
    finally { setActionBusy(false); }
  };
  const editPolicy = (item: Policy) => {
    setEditingPolicyId(item.policy_id);
    setPolicyDraft({ ...item });
    setPolicyEffectiveFrom(item.effective_from);
    setError(""); setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const togglePolicy = async (item: Policy) => {
    if (!item.is_active) {
      const today = policy?.today || todayISO();
      const suggested = item.effective_from > today ? item.effective_from : addDays(today, 1);
      setActivationTarget(item);
      setActivationDate(suggested);
      return;
    }
    if (!window.confirm(`Deactivate "${item.name}"? The Default policy will apply wherever this version is no longer active.`)) return;
    setActionBusy(true); setError(""); setNotice("");
    try {
      const res = await api.patch<PolicyOverview>(`/attendance/settings/${item.policy_id}/status`, { is_active: false });
      setPolicy(res.data); setPolicyDraft(res.data.current); setNotice(`${item.name} deactivated.`);
    } catch (e: any) { setError(e?.response?.data?.detail || "Could not change policy status."); }
    finally { setActionBusy(false); }
  };
  const confirmActivatePolicy = async () => {
    if (!activationTarget || !activationDate) return;
    setActionBusy(true); setError(""); setNotice("");
    try {
      const res = await api.patch<PolicyOverview>(`/attendance/settings/${activationTarget.policy_id}/status`, { is_active: true, effective_from: activationDate });
      setPolicy(res.data); setPolicyDraft(res.data.current); setNotice(`${activationTarget.name} activated from ${fmtDate(activationDate)}.`); setActivationTarget(null);
    } catch (e: any) { setError(e?.response?.data?.detail || "Could not activate policy."); }
    finally { setActionBusy(false); }
  };

  const deletePolicy = async (item: Policy) => {
    if (!window.confirm(`Delete policy "${item.name}"? This cannot be undone.`)) return;
    setActionBusy(true); setError(""); setNotice("");
    try {
      const res = await api.delete<PolicyOverview>(`/attendance/settings/${item.policy_id}`);
      setPolicy(res.data);
      setPolicyDraft(res.data.current);
      setNotice("Policy deleted.");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not delete the policy.");
    } finally { setActionBusy(false); }
  };

  const moveMonth = (direction: number) => setSelectedMonth((current) => shiftMonth(current, direction));
  const visibleDays = useMemo(() => mine?.days ?? [], [mine]);
  const filteredMineDays = useMemo(() => visibleDays.filter(day => {
    if (myStatusFilter === "ALL") return true;
    if (myStatusFilter === "LATE") return day.flags.includes("LATE");
    if (myStatusFilter === "INCOMPLETE") return !day.check_out_time && (day.flags.includes("MISSED_CHECKOUT") || Boolean(day.check_in_time && day.date < (mine?.today ?? "")));
    return day.status === myStatusFilter || (myStatusFilter === "PRESENT" && day.status === "ACTIVE");
  }), [visibleDays, myStatusFilter, mine?.today]);
  const myRecordsTotalPages = Math.max(1, Math.ceil(filteredMineDays.length / myRecordsPageSize));
  const pagedMineDays = useMemo(() => {
    const start = (myRecordsPage - 1) * myRecordsPageSize;
    return filteredMineDays.slice(start, start + myRecordsPageSize);
  }, [filteredMineDays, myRecordsPage, myRecordsPageSize]);
  useEffect(() => { setMyRecordsPage(1); }, [selectedMonth, myStatusFilter, myView, myRecordsPageSize]);
  useEffect(() => { if (myRecordsPage > myRecordsTotalPages) setMyRecordsPage(myRecordsTotalPages); }, [myRecordsPage, myRecordsTotalPages]);

  const monthlySummary = useMemo(() => {
    const days = visibleDays;
    const sum = (selector: (day: AttendanceDay) => number) => days.reduce((total, day) => total + selector(day), 0);
    return {
      present: sum(day => day.status === "PRESENT" || day.status === "ACTIVE" ? 1 : 0),
      halfDays: sum(day => day.status === "HALF_DAY" ? 1 : 0),
      absent: sum(day => day.status === "ABSENT" ? 1 : 0),
      worked: sum(day => day.worked_minutes ?? 0),
      overtime: sum(day => day.overtime_minutes ?? 0),
      late: sum(day => day.flags.includes("LATE") ? 1 : 0),
      early: sum(day => day.flags.includes("EARLY_LEAVE") ? 1 : 0),
      missing: sum(day => !day.check_out_time && (day.flags.includes("MISSED_CHECKOUT") || (day.check_in_time && day.date < (mine?.today ?? ""))) ? 1 : 0),
      weeklyOffs: sum(day => day.status === "WEEKEND" ? 1 : 0),
      leave: sum(day => day.status === "LEAVE" ? 1 : 0),
    };
  }, [visibleDays, mine?.today]);
  return <AppLayout pageTitle={activeTab === "mine" ? "My Attendance" : activeTab === "team" ? "Employee Attendance" : activeTab === "reports" ? "Attendance Reports" : "Attendance Settings"}>
    <Stack spacing={2.5}>
      <Box>
        <Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 12, mb: .7 }}>TIME & ATTENDANCE</Typography>
        <Typography sx={{ fontFamily: FONT, fontWeight: 750, color: INK, fontSize: 27, letterSpacing: "-.7px" }}>{activeTab === "mine" ? "My Attendance" : activeTab === "team" ? "Employee Attendance" : activeTab === "reports" ? "Attendance Reports" : "Attendance Settings"}</Typography>
        <Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 13, mt: .6 }}>{activeTab === "mine" ? "Check in and out, and review your monthly attendance." : activeTab === "team" ? "Review and correct employee attendance records." : activeTab === "reports" ? "Review attendance summaries and export reports." : "Manage attendance policies and effective dates."}</Typography>
      </Box>
      {error && <Alert severity="error" onClose={() => setError("")} sx={{ fontFamily: FONT, borderRadius: "10px" }}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")} sx={{ fontFamily: FONT, borderRadius: "10px" }}>{notice}</Alert>}
      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}><CircularProgress size={28} sx={{ color: INK }} /></Box>}

      {!loading && activeTab === "mine" && <>
        {mine && <>
          {mine.yesterday_checkout_missing && <Alert severity="warning" sx={{ fontFamily: FONT, mb: 1 }}>Your previous working day has a missing check-out. HR can correct it if needed.</Alert>}
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderColor: BORDER, borderRadius: "15px", boxShadow: "none", bgcolor: "#FFFFFF" }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" } }}>
              <Box>
                <Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 12 }}>TODAY · {fmtDate(mine.today)}</Typography>
                <Typography sx={{ fontFamily: FONT, color: INK, fontWeight: 750, fontSize: 23, mt: .6 }}>
                  {mine.state === "CHECKED_IN" ? "You're checked in" : mine.state === "CHECKED_OUT" ? "You're checked out" : mine.state === "NON_WORKING" ? "Non-working day" : "Ready to check in?"}
                </Typography>
                <Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 12, mt: .5 }}>
                  {mine.state === "CHECKED_IN" ? `Checked in at ${fmtTime(mine.days.find(d => d.date === mine.today)?.check_in_time)}` : mine.state === "CHECKED_OUT" ? "Your attendance for today is recorded." : "Your attendance status updates when you check in or out."}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1.2}>
                <Button disabled={!canMark || !mine.can_check_in || actionBusy} onClick={() => void doPunch("check-in")} variant="contained" startIcon={<CheckCircleRounded />}
                  sx={{ bgcolor: INK, textTransform: "none", fontFamily: FONT, fontWeight: 650, borderRadius: "9px", px: 2.2, boxShadow: "none", "&:hover": { bgcolor: "#30333A", boxShadow: "none" } }}>Check in</Button>
                <Button disabled={!canMark || !mine.can_check_out || actionBusy} onClick={() => void doPunch("check-out")} variant="outlined" startIcon={<AccessTimeRounded />}
                  sx={{ borderColor: BORDER, color: INK, textTransform: "none", fontFamily: FONT, fontWeight: 650, borderRadius: "9px", px: 2.2 }}>Check out</Button>
              </Stack>
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2.2 }, borderColor: BORDER, borderRadius: "15px", boxShadow: "none", bgcolor: "#FFFFFF" }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2, alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between" }}>
              <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
                <Box sx={{ width: 38, height: 38, borderRadius: "50%", bgcolor: "#F2F4F7", color: INK, display: "grid", placeItems: "center" }}><CalendarMonthRounded /></Box>
                <Box>
                  <Typography sx={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: INK }}>{monthLabel(selectedMonth)}</Typography>
                  <Typography sx={{ fontFamily: FONT, fontSize: 11, color: MUTED }}>Monthly attendance summary</Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={.8} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Button aria-label="Previous month" onClick={() => moveMonth(-1)} sx={{ minWidth: 38, width: 38, height: 38, border: `1px solid ${BORDER}`, borderRadius: "9px", color: INK }}><ArrowBackIosNewRounded sx={{ fontSize: 13 }} /></Button>
                <TextField aria-label="Choose attendance month" type="month" size="small" value={selectedMonth} onChange={e => { if (e.target.value) setSelectedMonth(e.target.value); }} sx={{ ...inputSx, width: 170 }} />
                <Button aria-label="Next month" onClick={() => moveMonth(1)} sx={{ minWidth: 38, width: 38, height: 38, border: `1px solid ${BORDER}`, borderRadius: "9px", color: INK }}><ArrowForwardIosRounded sx={{ fontSize: 13 }} /></Button>
                <ToggleButtonGroup size="small" exclusive value={myView} onChange={(_, value) => { if (value) setMyView(value); }} aria-label="Attendance view" sx={{ ml: { md: 1 }, height: 38, "& .MuiToggleButton-root": { borderColor: BORDER, color: MUTED, px: 1.1 }, "& .Mui-selected": { bgcolor: "#EAF2FF !important", color: "#245DB2 !important" } }}>
                  <ToggleButton value="table" aria-label="Table view"><TableRowsRounded fontSize="small" /></ToggleButton>
                  <ToggleButton value="timeline" aria-label="Timeline view"><ViewWeekRounded fontSize="small" /></ToggleButton>
                  <ToggleButton value="calendar" aria-label="Calendar view"><CalendarViewMonthRounded fontSize="small" /></ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(4,minmax(0,1fr))" }, gap: 1.2 }}>
              <Metric label="Present" value={monthlySummary.present} />
              <Metric label="Late" value={monthlySummary.late} />
              <Metric label="Incomplete" value={monthlySummary.missing} note="Missing check-outs" />
              <Metric label="Absent" value={monthlySummary.absent} />
            </Box>
          </Paper>
          <Paper variant="outlined" sx={{ borderColor: BORDER, borderRadius: "15px", boxShadow: "none", overflow: "hidden", bgcolor: "#FFFFFF" }}>
            <Box sx={{ px: { xs: 1.5, md: 2.2 }, py: 1.6, borderBottom: `1px solid ${BORDER}` }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.3} sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between" }}>
                <Box>
                  <Typography sx={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: INK }}>Attendance records</Typography>
                  <Typography sx={{ fontFamily: FONT, fontSize: 12, color: MUTED, mt: .35 }}>{filteredMineDays.length} days · {monthLabel(selectedMonth)}</Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <TextField select size="small" value={myStatusFilter} onChange={e => setMyStatusFilter(e.target.value)} sx={{ ...inputSx, minWidth: 160 }} slotProps={{ input: { startAdornment: <FilterListRounded sx={{ color: MUTED, fontSize: 18, mr: .7 }} /> } }}>
                    <MenuItem value="ALL">All records</MenuItem><MenuItem value="PRESENT">Present</MenuItem><MenuItem value="LATE">Late</MenuItem><MenuItem value="INCOMPLETE">Incomplete</MenuItem><MenuItem value="ABSENT">Absent</MenuItem><MenuItem value="LEAVE">On leave</MenuItem><MenuItem value="HOLIDAY">Holiday</MenuItem><MenuItem value="WEEKEND">Weekly off</MenuItem>
                  </TextField>
                </Stack>
              </Stack>
            </Box>
            {myView === "table" && <Box sx={{ overflowX: "auto" }}><Box sx={{ minWidth: 760 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "minmax(170px,1.5fr) minmax(120px,1fr) minmax(105px,.9fr) minmax(105px,.9fr) minmax(105px,.9fr) minmax(100px,.8fr)", gap: 1.2, px: 2.2, py: 1.35, bgcolor: "#F8F9FB", borderBottom: `1px solid ${BORDER}` }}>
                {["Date", "Status", "Check in", "Check out", "Worked", "Overtime"].map(label => <Typography key={label} sx={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: "#3F4650" }}>{label}</Typography>)}
              </Box>
              {pagedMineDays.map(day => <Box key={day.date} sx={{ display: "grid", gridTemplateColumns: "minmax(170px,1.5fr) minmax(120px,1fr) minmax(105px,.9fr) minmax(105px,.9fr) minmax(105px,.9fr) minmax(100px,.8fr)", gap: 1.2, alignItems: "center", px: 2.2, py: 1.55, borderBottom: `1px solid ${BORDER}`, bgcolor: day.status === "WEEKEND" ? "#EEF5FF" : "#FFFFFF", "&:last-child": { borderBottom: 0 } }}>
                <Typography sx={{ fontFamily: FONT, color: INK, fontSize: 12, fontWeight: 600 }}>{new Date(`${day.date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}</Typography>
                <Box><StatusChip status={day.status} />{(day.leave_type_name || day.holiday_name) && <Typography sx={{ fontFamily: FONT, fontSize: 9, color: MUTED, mt: .35 }}>{day.leave_type_name || day.holiday_name}{day.leave_days === .5 ? " · ½ day" : ""}</Typography>}{(day.flags.filter(flag => flag !== "MISSED_CHECKOUT" || !day.check_out_time).length > 0 || (!day.check_out_time && day.check_in_time && day.date < (mine?.today ?? ""))) && <Typography sx={{ fontFamily: FONT, fontSize: 10, color: MUTED, mt: .5 }}>{[...day.flags.filter(flag => flag !== "MISSED_CHECKOUT" || !day.check_out_time).map(flag => flag === "MISSED_CHECKOUT" ? "Missing check-out" : flag.replaceAll("_", " ").toLowerCase()), ...(!day.check_out_time && day.check_in_time && day.date < (mine?.today ?? "") && !day.flags.includes("MISSED_CHECKOUT") ? ["Missing check-out"] : [])].join(" · ")}</Typography>}</Box>
                <Typography sx={{ fontFamily: FONT, color: INK, fontSize: 12 }}>{fmtTime(day.check_in_time)}</Typography><Typography sx={{ fontFamily: FONT, color: INK, fontSize: 12 }}>{fmtTime(day.check_out_time)}</Typography>
                <Typography sx={{ fontFamily: FONT, color: INK, fontSize: 12, fontWeight: 600 }}>{fmtHours(day.worked_minutes)}</Typography><Typography sx={{ fontFamily: FONT, color: day.overtime_minutes > 0 ? "#16845B" : MUTED, fontSize: 12, fontWeight: day.overtime_minutes > 0 ? 650 : 500 }}>{day.overtime_minutes > 0 ? `+${fmtHours(day.overtime_minutes)}` : "—"}</Typography>
              </Box>)}
              {!filteredMineDays.length && <Typography sx={{ fontFamily: FONT, color: MUTED, py: 4, textAlign: "center", fontSize: 13 }}>No attendance records match this filter.</Typography>}
            </Box></Box>}
            {myView === "timeline" && <Stack spacing={1} sx={{ p: 1.4, bgcolor: "#F5F6F8" }}>
              {pagedMineDays.map(day => {
                const weekend = day.status === "WEEKEND"; const absent = day.status === "ABSENT"; const present = day.status === "PRESENT" || day.status === "ACTIVE";
                const lineColor = weekend ? "#4C8DE8" : absent ? "#D94B5B" : day.status === "LEAVE" ? "#D5A321" : present ? "#27A879" : "#B9C0CA";
                return <Box key={day.date} sx={{ display: "grid", gridTemplateColumns: { xs: "58px 1fr", md: "72px minmax(85px,.7fr) minmax(100px,2fr) minmax(85px,.7fr) minmax(100px,.8fr)" }, gap: 1.4, alignItems: "center", p: 1.5, borderRadius: "12px", bgcolor: "#fff", border: `1px solid ${BORDER}` }}>
                  <Box><Typography sx={{ fontFamily: FONT, fontWeight: 700, color: INK, fontSize: 15 }}>{new Date(`${day.date}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit" })}</Typography><Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 10, textTransform: "uppercase" }}>{new Date(`${day.date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short" })}</Typography></Box>
                  <Typography sx={{ display: { xs: "none", md: "block" }, fontFamily: FONT, fontSize: 12, color: INK }}>{fmtTime(day.check_in_time)}</Typography>
                  <Box sx={{ minWidth: 0 }}><Box sx={{ height: 2, bgcolor: lineColor, position: "relative", mx: 1.3 }}><Box sx={{ position: "absolute", width: 9, height: 9, borderRadius: "50%", bgcolor: lineColor, top: -3.5, left: 0 }} /><Box sx={{ position: "absolute", width: 9, height: 9, borderRadius: "50%", bgcolor: day.check_out_time ? lineColor : "#D5D8DE", top: -3.5, right: 0 }} /><Box sx={{ position: "absolute", left: "50%", transform: "translate(-50%,-50%)", top: "50%", whiteSpace: "nowrap", bgcolor: "#fff", border: `1px solid ${lineColor}70`, borderRadius: "6px", px: 1, py: .25 }}><Typography sx={{ fontFamily: FONT, fontSize: 10, color: INK }}>{statusLabel(day.status)}{day.leave_type_name ? ` · ${day.leave_type_name}` : day.holiday_name ? ` · ${day.holiday_name}` : ""}</Typography></Box></Box></Box>
                  <Typography sx={{ display: { xs: "none", md: "block" }, fontFamily: FONT, fontSize: 12, color: INK }}>{fmtTime(day.check_out_time)}</Typography>
                  <Box sx={{ gridColumn: { xs: "2", md: "auto" }, display: "flex", justifyContent: { xs: "flex-start", md: "flex-end" }, gap: 1, alignItems: "center" }}><Typography sx={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: INK }}>{fmtHours(day.worked_minutes)}</Typography><Typography sx={{ fontFamily: FONT, fontSize: 10, color: MUTED }}>worked</Typography></Box>
                </Box>;
              })}
              {!filteredMineDays.length && <Typography sx={{ fontFamily: FONT, color: MUTED, py: 4, textAlign: "center", fontSize: 13 }}>No attendance records match this filter.</Typography>}
            </Stack>}
            {(myView === "table" || myView === "timeline") && <TablePagination component="div" count={filteredMineDays.length} page={Math.max(0, myRecordsPage - 1)} onPageChange={(_, nextPage) => setMyRecordsPage(nextPage + 1)} rowsPerPage={myRecordsPageSize} onRowsPerPageChange={e => { setMyRecordsPageSize(Number(e.target.value)); setMyRecordsPage(1); }} rowsPerPageOptions={[5, 10, 15, 25]} sx={{ borderTop: `1px solid ${BORDER}`, '& .MuiTablePagination-toolbar': { fontFamily: FONT, minHeight: 52 }, '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontFamily: FONT, fontSize: 11, color: MUTED }, '& .MuiTablePagination-select': { fontFamily: FONT, fontSize: 12 } }} />}
            {myView === "calendar" && <Box sx={{ p: { xs: 1, md: 2 } }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: .7, mb: .7 }}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <Typography key={day} sx={{ fontFamily: FONT, textAlign: "center", color: MUTED, fontSize: 11, fontWeight: 700, py: .8 }}>{day}</Typography>)}</Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: .7 }}>
                {Array.from({ length: new Date(Number(selectedMonth.slice(0,4)), Number(selectedMonth.slice(5,7))-1, 1).getDay() }, (_, i) => <Box key={`blank-${i}`} sx={{ minHeight: { xs: 68, sm: 92 } }} />)}
                {Array.from({ length: new Date(Number(selectedMonth.slice(0,4)), Number(selectedMonth.slice(5,7)), 0).getDate() }, (_, i) => {
                  const date = `${selectedMonth}-${String(i+1).padStart(2,"0")}`; const day = filteredMineDays.find(item => item.date === date); const present = day?.status === "PRESENT" || day?.status === "ACTIVE"; const weekend = day?.status === "WEEKEND"; const absent = day?.status === "ABSENT"; const leave = day?.status === "LEAVE";
                  const bg = present ? "#CFF4D8" : absent ? "#FCE0E3" : leave ? "#FFF0B3" : weekend ? "#CFE2FF" : day?.status === "HOLIDAY" ? "#F1F2F5" : "#FFFFFF";
                  const fg = present ? "#116B35" : absent ? "#B42335" : leave ? "#8A5700" : weekend ? "#174EA6" : INK;
                  return <Box key={date} sx={{ minWidth: 0, minHeight: { xs: 68, sm: 92 }, p: { xs: .6, sm: 1 }, border: `1px solid ${present ? "#7BD695" : weekend ? "#75A9F8" : BORDER}`, borderRadius: "9px", bgcolor: bg }}>
                    <Typography sx={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: fg }}>{i+1}</Typography>
                    {day && <><Typography sx={{ fontFamily: FONT, fontSize: { xs: 9, sm: 10 }, color: fg, mt: .6, lineHeight: 1.25, overflowWrap: "anywhere" }}>{statusLabel(day.status)}</Typography>{(day.leave_type_name || day.holiday_name) && <Typography title={day.leave_type_name || day.holiday_name || ""} sx={{ fontFamily: FONT, fontSize: 8, color: fg, mt: .35, lineHeight: 1.2, overflowWrap: "anywhere" }}>{day.leave_type_name || day.holiday_name}{day.leave_days === .5 ? " · ½ day" : ""}</Typography>}<Typography sx={{ fontFamily: FONT, fontSize: { xs: 9, sm: 10 }, color: INK, fontWeight: 650, mt: .5 }}>{day.worked_minutes != null ? fmtHours(day.worked_minutes) : "—"}</Typography></>}
                  </Box>;
                })}
              </Box>
              <Divider sx={{ my: 1.6, borderColor: BORDER }} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}>
                <Stack direction="row" spacing={1.2} sx={{ flexWrap: "wrap" }} useFlexGap>{[["#16845B","Present"],["#2769C7","Weekly off"],["#C53B4B","Absent"],["#B77908","Leave"]].map(([color,label]) => <Stack key={label} direction="row" spacing={.5} sx={{ alignItems: "center" }}><Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} /><Typography sx={{ fontFamily: FONT, fontSize: 10, color: MUTED }}>{label}</Typography></Stack>)}</Stack>
                <Typography sx={{ fontFamily: FONT, fontSize: 13, color: INK, fontWeight: 700 }}>Total working hours: {fmtHours(monthlySummary.worked)}</Typography>
              </Stack>
            </Box>}
          </Paper>
        </>}
      </>}

      {!loading && activeTab === "team" && <>
        <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2.2 }, borderColor: BORDER, borderRadius: "15px", boxShadow: "none", bgcolor: "#FFFFFF" }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between", mb: 2 }}>
            <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
              <Box sx={{ width: 38, height: 38, borderRadius: "50%", bgcolor: "#F2F4F7", color: INK, display: "grid", placeItems: "center", flexShrink: 0 }}><CalendarMonthRounded /></Box>
              <Box>
                <Typography sx={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: INK }}>
                  {teamView === "calendar" ? monthLabel(teamMonth) : teamView === "week" ? `Week of ${fmtDate(teamDate)}` : fmtDate(teamDate)}
                </Typography>
                <Typography sx={{ fontFamily: FONT, fontSize: 11, color: MUTED }}>
                  {teamView === "calendar" ? "Monthly attendance summary" : teamView === "week" ? "Weekly attendance summary" : "Daily attendance summary"}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={.8} sx={{ alignItems: "center", justifyContent: { xs: "flex-start", md: "flex-end" }, flexWrap: "wrap" }}>
              <Button aria-label="Previous day or month" onClick={() => { setPage(1); if (teamView === "calendar") setTeamMonth(m => shiftMonth(m, -1)); else setTeamDate(d => addDays(d, teamView === "week" ? -7 : -1)); }} sx={{ minWidth: 38, width: 38, height: 38, border: `1px solid ${BORDER}`, borderRadius: "9px", color: INK, p: 0 }}><ArrowBackIosNewRounded sx={{ fontSize: 13 }} /></Button>
              {teamView === "calendar"
                ? <TextField aria-label="Choose attendance month" type="month" size="small" value={teamMonth} onChange={e => { if (e.target.value) { setTeamMonth(e.target.value); setPage(1); } }} sx={{ ...inputSx, width: 170 }} />
                : <TextField aria-label="Choose attendance date" type="date" size="small" value={teamDate} onChange={e => { if (e.target.value) { setTeamDate(e.target.value); setPage(1); } }} sx={{ ...inputSx, width: 170 }} />}
              <Button aria-label="Next day or month" onClick={() => { setPage(1); if (teamView === "calendar") setTeamMonth(m => shiftMonth(m, 1)); else setTeamDate(d => addDays(d, teamView === "week" ? 7 : 1)); }} sx={{ minWidth: 38, width: 38, height: 38, border: `1px solid ${BORDER}`, borderRadius: "9px", color: INK, p: 0 }}><ArrowForwardIosRounded sx={{ fontSize: 13 }} /></Button>
              <ToggleButtonGroup exclusive size="small" value={teamView} onChange={(_, v) => { if (v) { setTeamView(v); setPage(1); } }} aria-label="Attendance view" sx={{ ml: { md: .5 }, height: 38, "& .MuiToggleButton-root": { borderColor: BORDER, color: MUTED, px: 1.1 }, "& .Mui-selected": { bgcolor: "#EAF2FF !important", color: "#245DB2 !important" } }}>
                <ToggleButton value="daily" aria-label="Daily list view"><TableRowsRounded fontSize="small" /></ToggleButton>
                <ToggleButton value="week" aria-label="Weekly timeline view"><ViewWeekRounded fontSize="small" /></ToggleButton>
                <ToggleButton value="calendar" aria-label="Calendar view"><CalendarViewMonthRounded fontSize="small" /></ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(4,minmax(0,1fr))" }, gap: 1.2 }}>
            <Metric label="Present" value={report?.summary.present ?? "—"} note="Checked in or completed" />
            <Metric label="Late" value={report?.summary.late ?? "—"} note="Late arrivals" />
            <Metric label="Incomplete" value={report?.summary.missed_checkout ?? "—"} note="Missing check-outs" />
            <Metric label="Absent" value={report?.summary.absent ?? "—"} note="Expected to work" />
          </Box>
        </Paper>
                {report && <>
          {teamView === "daily" && <Paper variant="outlined" sx={{ borderColor: BORDER, borderRadius: "13px", boxShadow: "none", overflow: "hidden" }}>
            <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: `1px solid ${BORDER}` }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between", mb: 1.5 }}>
                <Box><Typography sx={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: INK }}>Employee records</Typography><Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 11, mt: .25 }}>Attendance on {fmtDate(teamDate)} · {report.total} employees</Typography></Box>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { xs: "stretch", sm: "center" }, flexWrap: "wrap" }}>
                  <TextField size="small" placeholder="Search name or employee code" value={query} onChange={e => setQuery(e.target.value)} sx={{ ...inputSx, width: { xs: "100%", sm: 220 } }} />
                  <FormControl size="small" sx={{ ...inputSx, minWidth: { xs: "100%", sm: 145 } }}><Select displayEmpty value={departmentId} onChange={e => { setDepartmentId(e.target.value); setPage(1); }}><MenuItem value="">All departments</MenuItem>{departments.map(d => <MenuItem key={d.id} value={String(d.id)}>{d.name}</MenuItem>)}</Select></FormControl>
                  <FormControl size="small" sx={{ ...inputSx, minWidth: { xs: "100%", sm: 135 } }}><Select displayEmpty value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><MenuItem value="">All statuses</MenuItem>{["PRESENT","HALF_DAY","ABSENT","LATE","MISSED_CHECKOUT","OVERTIME","YET_TO_CHECK_IN","WEEKEND","HOLIDAY"].map(v => <MenuItem key={v} value={v}>{statusLabel(v)}</MenuItem>)}</Select></FormControl>
                  <Button onClick={() => void downloadCsv(false)} startIcon={<DownloadRounded />} sx={{ color: INK, border: `1px solid ${BORDER}`, borderRadius: "9px", textTransform: "none", fontFamily: FONT, minHeight: 40, px: 1.5, whiteSpace: "nowrap" }}>Export</Button>
                </Stack>
              </Stack>
            </Box>
            <Box sx={{ overflowX: "auto" }}><Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: 850, "& th": { textAlign: "left", bgcolor: "#F7F7F5", color: MUTED, fontFamily: FONT, fontSize: 10, letterSpacing: ".35px", textTransform: "uppercase", p: 1.5, whiteSpace: "nowrap", borderBottom: `1px solid ${BORDER}` }, "& td": { fontFamily: FONT, fontSize: 12, color: INK, p: 1.5, borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" } }}>
              <thead><tr><th>Employee</th><th>Department</th><th>Check-in</th><th>Check-out</th><th>Working hours</th><th>Overtime</th><th>Status</th>{canCorrect && <th>Action</th>}</tr></thead>
              <tbody>{report.rows.map(row => { const cell = row.cells[0]; const pending = Boolean(cell && !cell.check_out_time && cell.missed_checkout_pending); return <tr key={row.employee_id}>
                <td><Typography sx={{ fontFamily: FONT, fontSize: 12, fontWeight: 650 }}>{row.employee_name}</Typography><Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 10 }}>{row.employee_code}</Typography></td><td>{row.department_name || "—"}</td><td>{fmtTime(cell?.check_in_time)}</td><td>{fmtTime(cell?.check_out_time)}</td><td>{fmtHours(cell?.worked_minutes)}</td><td>{cell?.overtime_minutes ? `+${fmtHours(cell.overtime_minutes)}` : "—"}</td><td><Stack direction="row" spacing={.6} sx={{ alignItems: "center" }}><StatusChip status={pending ? "MISSED_CHECKOUT" : cell?.status ?? null} />{cell?.flags.includes("LATE") && <Chip size="small" label="Late" sx={{ fontFamily: FONT, bgcolor: "#FFF0D5", color: "#925900", fontSize: 10 }} />}</Stack></td>{canCorrect && <td><Button size="small" onClick={() => cell && openCorrection(row, cell)} disabled={!cell || !canCorrect} sx={{ fontFamily: FONT, textTransform: "none", color: INK }}>{pending ? "Fix check-out" : "Correct"}</Button></td>}
              </tr>; })}{!report.rows.length && <tr><td colSpan={canCorrect ? 8 : 7} style={{ textAlign: "center", color: MUTED, padding: 28 }}>No employees match these filters for this date.</td></tr>}</tbody>
            </Box></Box>
            <TablePagination component="div" count={report.total} page={Math.max(0, report.page - 1)} onPageChange={(_, nextPage) => setPage(nextPage + 1)} rowsPerPage={pageSize} onRowsPerPageChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} rowsPerPageOptions={[10, 25, 50]} sx={{ borderTop: `1px solid ${BORDER}`, '& .MuiTablePagination-toolbar': { fontFamily: FONT, minHeight: 52 }, '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontFamily: FONT, fontSize: 11, color: MUTED }, '& .MuiTablePagination-select': { fontFamily: FONT, fontSize: 12 } }} />
          </Paper>}
          {teamView !== "daily" && <Paper variant="outlined" sx={{ borderColor: BORDER, borderRadius: "13px", boxShadow: "none", bgcolor: "#FFFFFF", overflow: "hidden" }}>
            <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: `1px solid ${BORDER}` }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between" }}>
                <Box sx={{ minWidth: 180 }}><Typography sx={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: INK }}>Employee records</Typography><Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 11, mt: .25 }}>Filter by employee, department or status.</Typography></Box>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { xs: "stretch", sm: "center" }, flexWrap: "wrap" }}>
                  <TextField size="small" placeholder="Search name or employee code" value={query} onChange={e => setQuery(e.target.value)} sx={{ ...inputSx, width: { xs: "100%", sm: 220 } }} />
                  <FormControl size="small" sx={{ ...inputSx, minWidth: { xs: "100%", sm: 145 } }}><Select displayEmpty value={departmentId} onChange={e => { setDepartmentId(e.target.value); setPage(1); }}><MenuItem value="">All departments</MenuItem>{departments.map(d => <MenuItem key={d.id} value={String(d.id)}>{d.name}</MenuItem>)}</Select></FormControl>
                  <FormControl size="small" sx={{ ...inputSx, minWidth: { xs: "100%", sm: 135 } }}><Select displayEmpty value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><MenuItem value="">All statuses</MenuItem>{["PRESENT","HALF_DAY","ABSENT","LATE","MISSED_CHECKOUT","OVERTIME","YET_TO_CHECK_IN","WEEKEND","HOLIDAY"].map(v => <MenuItem key={v} value={v}>{statusLabel(v)}</MenuItem>)}</Select></FormControl>
                  <Button onClick={() => void downloadCsv(false)} startIcon={<DownloadRounded />} sx={{ color: INK, border: `1px solid ${BORDER}`, borderRadius: "9px", textTransform: "none", fontFamily: FONT, minHeight: 40, px: 1.5, whiteSpace: "nowrap" }}>Export</Button>
                </Stack>
              </Stack>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, px: 2, py: 1.3, borderBottom: `1px solid ${BORDER}` }}>
              <Box><Typography sx={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: INK }}>{teamView === "week" ? "Weekly attendance timeline" : `Attendance calendar · ${monthLabel(teamMonth)}`}</Typography><Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 12, mt: .3 }}>{report.total} employees · {teamView === "week" ? `${fmtDate(report.from_date)} – ${fmtDate(report.to_date)}` : "Select a date to inspect that day's attendance"}</Typography></Box>
            </Stack>
          {teamView === "week" && <Box sx={{ overflow: "hidden" }}><Box sx={{ px: 1.8, py: 1.1, bgcolor: "#F7F9FC", borderBottom: `1px solid ${BORDER}` }}><Typography sx={{ fontFamily: FONT, fontSize: 11, color: MUTED }}>Weekly calendar · Use the left and right arrows above to move between weeks. Select any day cell to view or correct that employee's attendance.</Typography></Box><Box sx={{ overflowX: "auto" }}><Box component="table" sx={{ width: "100%", minWidth: 1250, borderCollapse: "collapse", "& th, & td": { borderBottom: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`, p: 1.1, fontFamily: FONT, fontSize: 11 }, "& th": { bgcolor: "#F7F7F5", color: MUTED, fontWeight: 700, textAlign: "left" } }}><thead><tr><th style={{ position: "sticky", left: 0, zIndex: 2, minWidth: 190 }}>Employee</th>{report.days.map(d => <th key={d} style={{ minWidth: 145, textAlign: "center", background: d === todayISO() ? "#EAF2FF" : "#F7F7F5" }}><div style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>{new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short" })}</div><div style={{ fontSize: 13, color: INK, fontWeight: 750 }}>{new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div></th>)}</tr></thead><tbody>{report.rows.map(row => <tr key={row.employee_id}><td style={{ position: "sticky", left: 0, zIndex: 1, background: "#FFFFFF", minWidth: 190 }}><Typography sx={{ fontFamily: FONT, fontWeight: 650, fontSize: 12 }}>{row.employee_name}</Typography><Typography sx={{ fontFamily: FONT, fontSize: 10, color: MUTED }}>{row.employee_code}</Typography></td>{row.cells.map(cell => { const isPresent = cell.status === "PRESENT" || cell.status === "ACTIVE"; const bg = isPresent ? "#CFF4D8" : cell.status === "ABSENT" ? "#FCE0E3" : cell.status === "LEAVE" || cell.status === "HALF_DAY" ? "#FFF0B3" : cell.status === "WEEKEND" || cell.status === "HOLIDAY" ? "#CFE2FF" : "#FFFFFF"; return <td key={cell.date} title={`${fmtDate(cell.date)} · ${statusLabel(cell.status)} · ${fmtTime(cell.check_in_time)}–${fmtTime(cell.check_out_time)}`} onClick={() => canCorrect && openCorrection(row, cell)} style={{ background: bg, cursor: canCorrect ? "pointer" : "default", minWidth: 145, verticalAlign: "top", padding: 12 }}><Typography sx={{ fontFamily: FONT, fontSize: 10, fontWeight: 650 }}>{statusLabel(cell.status)}</Typography><Typography sx={{ fontFamily: FONT, fontSize: 10 }}>{cell.check_in_time ? fmtTime(cell.check_in_time) : "—"} – {cell.check_out_time ? fmtTime(cell.check_out_time) : "—"}</Typography><Typography sx={{ fontFamily: FONT, fontSize: 10, color: INK }}>{fmtHours(cell.worked_minutes)}</Typography></td>; })}</tr>)}</tbody></Box></Box></Box>}
          {teamView === "calendar" && <Box sx={{ p: 1.5 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: .7, mb: .7 }}>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <Typography key={d} sx={{ fontFamily: FONT, textAlign: "center", color: MUTED, fontSize: 11, fontWeight: 700, py: .8 }}>{d}</Typography>)}</Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: .7 }}>
              {Array.from({ length: new Date(Number(teamMonth.slice(0,4)), Number(teamMonth.slice(5,7))-1, 1).getDay() }, (_, i) => <Box key={`empty-${i}`} />)}
              {Array.from({ length: new Date(Number(teamMonth.slice(0,4)), Number(teamMonth.slice(5,7)), 0).getDate() }, (_, i) => { const date = `${teamMonth}-${String(i+1).padStart(2,"0")}`; const isSelected = date === teamDate; const isToday = date === todayISO(); const cells = report.rows.map(r => r.cells.find(c => c.date === date)).filter(Boolean) as ReportCell[]; const present = cells.filter(c => c.status === "PRESENT" || c.status === "ACTIVE").length; const absent = cells.filter(c => c.status === "ABSENT").length; const incomplete = cells.filter(c => !c.check_out_time && c.missed_checkout_pending).length; const weekend = cells.length > 0 && cells.every(c => c.status === "WEEKEND" || c.status === "HOLIDAY"); const bg = weekend ? "#CFE2FF" : present > 0 ? "#CFF4D8" : absent > 0 ? "#FCE0E3" : "#FFFFFF"; return <Box key={date} role="button" tabIndex={0} onClick={() => { setTeamDate(date); setTeamView("daily"); setPage(1); }} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTeamDate(date); setTeamView("daily"); setPage(1); } }} sx={{ minHeight: { xs: 74, sm: 94 }, p: { xs: .5, sm: .8 }, border: `1px solid ${isSelected ? INK : isToday ? "#2769C7" : BORDER}`, borderRadius: "9px", bgcolor: bg, cursor: "pointer", outline: "none", "&:hover": { borderColor: INK, boxShadow: "0 0 0 1px #17191F18" } }}><Typography sx={{ fontFamily: FONT, fontWeight: 750, fontSize: 12, color: weekend ? "#174EA6" : INK }}>{i+1}</Typography><Typography sx={{ fontFamily: FONT, fontSize: 9, color: "#116B35", mt: .5 }}>{present} present</Typography><Typography sx={{ fontFamily: FONT, fontSize: 9, color: "#B42335" }}>{absent} absent</Typography>{incomplete > 0 && <Typography sx={{ fontFamily: FONT, fontSize: 9, color: "#925900" }}>{incomplete} incomplete</Typography>}</Box>; })}
            </Box>
            <Divider sx={{ my: 1.5, borderColor: BORDER }} /><Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }} useFlexGap><Typography sx={{ fontFamily: FONT, fontSize: 11, color: "#116B35" }}>Green: present</Typography><Typography sx={{ fontFamily: FONT, fontSize: 11, color: "#174EA6" }}>Blue: weekly off / holiday</Typography><Typography sx={{ fontFamily: FONT, fontSize: 11, color: "#B42335" }}>Red: absent</Typography><Typography sx={{ fontFamily: FONT, fontSize: 11, color: "#8A5700" }}>Yellow: leave / half day</Typography></Stack>
          </Box>}
          {teamView !== "calendar" && <TablePagination component="div" count={report.total} page={Math.max(0, report.page - 1)} onPageChange={(_, nextPage) => setPage(nextPage + 1)} rowsPerPage={pageSize} onRowsPerPageChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} rowsPerPageOptions={[10, 25, 50]} sx={{ borderTop: `1px solid ${BORDER}`, '& .MuiTablePagination-toolbar': { fontFamily: FONT, minHeight: 52 }, '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontFamily: FONT, fontSize: 11, color: MUTED }, '& .MuiTablePagination-select': { fontFamily: FONT, fontSize: 12 } }} />}
          </Paper>}
        </>}
      </>}

      {!loading && activeTab === "reports" && <>
        {report && <>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" }, flexWrap: "wrap", gap: 1, mb: .5 }}>
            <Box><Typography sx={{ fontFamily: FONT, fontWeight: 750, fontSize: 19, color: INK }}>Attendance overview</Typography><Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 12, mt: .3 }}>{fmtDate(report.from_date)} – {fmtDate(report.to_date)} · {report.period_summary.employees} active employees</Typography></Box>
            <Stack direction="row" spacing={.7} sx={{ flexWrap: "wrap" }}>
              <Button size="small" onClick={() => { const d = new Date(); const monday = addDays(todayISO(), -((d.getDay() + 6) % 7)); setFromDate(monday); setToDate(addDays(monday, 6)); setPage(1); }} sx={{ color: INK, border: `1px solid ${BORDER}`, borderRadius: "8px", textTransform: "none", fontFamily: FONT }}>This week</Button>
              <Button size="small" onClick={() => { setFromDate(monthStart(currentMonthValue())); setToDate(todayISO()); setPage(1); }} sx={{ color: INK, border: `1px solid ${BORDER}`, borderRadius: "8px", textTransform: "none", fontFamily: FONT }}>This month</Button>
              <Button size="small" onClick={() => { const previous = shiftMonth(currentMonthValue(), -1); setFromDate(monthStart(previous)); setToDate(monthEnd(previous)); setPage(1); }} sx={{ color: INK, border: `1px solid ${BORDER}`, borderRadius: "8px", textTransform: "none", fontFamily: FONT }}>Last month</Button>
            </Stack>
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(3,minmax(0,1fr))", xl: "repeat(6,minmax(0,1fr))" }, gap: 1.3 }}>
            <Metric label="Attendance rate" value={`${report.period_summary.attendance_rate}%`} note="Half days count as 0.5" />
            <Metric label="Present days" value={report.period_summary.present_days} note="Full attendance days" />
            <Metric label="Short days" value={report.period_summary.short_days} note="Below full-day hours" />
            <Metric label="No record" value={report.period_summary.no_record_days} note="Scheduled days with no entry" />
            <Metric label="Late arrivals" value={report.period_summary.late_count} note="Late flags in period" />
            <Metric label="Needs action" value={report.period_summary.needs_action} note="Incomplete check-outs" />
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.35fr 1fr" }, gap: 1.5 }}>
            <Paper variant="outlined" sx={{ p: 2, borderColor: BORDER, borderRadius: "13px", boxShadow: "none", minWidth: 0 }}>
              <SectionTitle title="Attendance trend" subtitle="Daily attendance rate across scheduled working days" icon={<AccessTimeRounded />} />
              <Box sx={{ display: "flex", alignItems: "end", gap: .7, height: 150, overflowX: "auto", pb: .5 }}>
                {report.daily_trend.map(point => <Box key={point.date} title={`${fmtDate(point.date)} · ${point.attendance_rate}% · ${point.present} present · ${point.late} late`} sx={{ minWidth: report.daily_trend.length > 14 ? 12 : 22, flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "end", alignItems: "center", gap: .5 }}>
                  <Typography sx={{ fontFamily: FONT, fontSize: 9, color: MUTED }}>{point.attendance_rate}%</Typography>
                  <Box sx={{ width: "100%", maxWidth: 28, height: `${Math.max(3, point.attendance_rate)}%`, bgcolor: "#25282E", borderRadius: "5px 5px 2px 2px", minHeight: 3 }} />
                  <Typography sx={{ fontFamily: FONT, fontSize: 9, color: MUTED }}>{new Date(`${point.date}T12:00:00`).getDate()}</Typography>
                </Box>)}
              </Box>
              <Typography sx={{ fontFamily: FONT, fontSize: 10, color: MUTED, mt: .5 }}>Days with no scheduled work are excluded from the trend.</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, borderColor: BORDER, borderRadius: "13px", boxShadow: "none", minWidth: 0 }}>
              <SectionTitle title="Working hours" subtitle="Across the selected date range" icon={<AccessTimeRounded />} />
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mt: 2 }}>
                <Box><Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 11 }}>Total worked</Typography><Typography sx={{ fontFamily: FONT, fontWeight: 750, fontSize: 23, color: INK }}>{fmtHours(report.period_summary.worked_minutes)}</Typography></Box>
                <Box><Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 11 }}>Overtime</Typography><Typography sx={{ fontFamily: FONT, fontWeight: 750, fontSize: 23, color: INK }}>{fmtHours(report.period_summary.overtime_minutes)}</Typography></Box>
                <Box><Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 11 }}>Early departures</Typography><Typography sx={{ fontFamily: FONT, fontWeight: 700, fontSize: 18, color: INK }}>{report.period_summary.early_leave_count}</Typography></Box>
                <Box><Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 11 }}>Scheduled employee-days</Typography><Typography sx={{ fontFamily: FONT, fontWeight: 700, fontSize: 18, color: INK }}>{report.period_summary.scheduled_days}</Typography></Box>
              </Box>
            </Paper>
          </Box>
          <Paper variant="outlined" sx={{ p: 2, borderColor: BORDER, borderRadius: "13px", boxShadow: "none", overflow: "hidden" }}>
            <SectionTitle title="Department-wise attendance" subtitle="Compare attendance performance across departments" icon={<TableRowsRounded />} />
            <Box sx={{ overflowX: "auto" }}><Box component="table" sx={{ width: "100%", minWidth: 650, borderCollapse: "collapse", "& th": { textAlign: "left", fontFamily: FONT, fontSize: 10, color: MUTED, textTransform: "uppercase", p: 1.2, borderBottom: `1px solid ${BORDER}` }, "& td": { fontFamily: FONT, fontSize: 12, color: INK, p: 1.2, borderBottom: `1px solid ${BORDER}` } }}><thead><tr><th>Department</th><th>Attendance</th><th>Present</th><th>Short days</th><th>No record</th><th>Late</th><th>Needs action</th></tr></thead><tbody>{report.department_summary.map(dept => <tr key={dept.department}><td style={{ fontWeight: 650 }}>{dept.department}</td><td><Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><Box sx={{ width: 65, height: 6, bgcolor: "#ECEDEF", borderRadius: 5, overflow: "hidden" }}><Box sx={{ width: `${dept.attendance_rate}%`, height: "100%", bgcolor: "#25282E" }} /></Box>{dept.attendance_rate}%</Box></td><td>{dept.present_days}</td><td>{dept.short_days}</td><td>{dept.no_record_days}</td><td>{dept.late_count}</td><td>{dept.needs_action}</td></tr>)}{!report.department_summary.length && <tr><td colSpan={7}>No department data for this period.</td></tr>}</tbody></Box></Box>
          </Paper>
        </>}

        <Paper variant="outlined" sx={{ p: 2, borderColor: BORDER, borderRadius: "13px", boxShadow: "none" }}><Stack direction={{ xs: "column", lg: "row" }} spacing={1.4} sx={{ alignItems: { xs: "stretch", lg: "flex-end" } }}>
          <Field label="From date"><TextField type="date" size="small" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} sx={inputSx} fullWidth /></Field><Field label="To date"><TextField type="date" size="small" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} sx={inputSx} fullWidth /></Field><Field label="Employee search"><TextField size="small" placeholder="Name or employee code" value={query} onChange={e => setQuery(e.target.value)} sx={inputSx} fullWidth /></Field><Field label="Department"><FormControl size="small" fullWidth sx={inputSx}><Select displayEmpty value={departmentId} onChange={e => { setDepartmentId(e.target.value); setPage(1); }}><MenuItem value="">All departments</MenuItem>{departments.map(d => <MenuItem key={d.id} value={String(d.id)}>{d.name}</MenuItem>)}</Select></FormControl></Field><Field label="Status"><FormControl size="small" fullWidth sx={inputSx}><Select displayEmpty value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><MenuItem value="">All statuses</MenuItem>{["PRESENT","HALF_DAY","ABSENT","LATE","EARLY_LEAVE","MISSED_CHECKOUT","OVERTIME","YET_TO_CHECK_IN","WEEKEND","HOLIDAY"].map(v => <MenuItem key={v} value={v}>{statusLabel(v)}</MenuItem>)}</Select></FormControl></Field><Button onClick={() => void downloadCsv(true)} startIcon={<DownloadRounded />} sx={{ color: INK, border: `1px solid ${BORDER}`, borderRadius: "9px", textTransform: "none", fontFamily: FONT, minHeight: 40 }}>Export CSV</Button>
        </Stack></Paper>
        {report && <Paper variant="outlined" sx={{ borderColor: BORDER, borderRadius: "13px", boxShadow: "none", overflow: "hidden" }}><Box sx={{ p: 2.2, borderBottom: `1px solid ${BORDER}` }}><SectionTitle title="Attendance report" subtitle={`${fmtDate(report.from_date)} – ${fmtDate(report.to_date)} · ${report.total} employee records`} icon={<CalendarMonthRounded />} /></Box><Box sx={{ overflowX: "auto" }}><Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: 920, "& th": { textAlign: "left", bgcolor: "#F7F7F5", color: MUTED, fontFamily: FONT, fontSize: 10, letterSpacing: ".35px", textTransform: "uppercase", p: 1.5, whiteSpace: "nowrap", borderBottom: `1px solid ${BORDER}` }, "& td": { fontFamily: FONT, fontSize: 12, color: INK, p: 1.5, borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" } }}><thead><tr><th>Employee</th><th>Department</th><th>Present</th><th>Half days</th><th>Absent</th><th>Late</th><th>Worked</th><th>Overtime</th><th>Daily records</th></tr></thead><tbody>{report.rows.map(row => <tr key={row.employee_id}><td><Typography sx={{ fontFamily: FONT, fontSize: 12, fontWeight: 650 }}>{row.employee_name}</Typography><Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 10 }}>{row.employee_code}</Typography></td><td>{row.department_name || "—"}</td><td>{row.totals.present_days}</td><td>{row.totals.half_days}</td><td>{row.totals.absent_days}</td><td>{row.totals.late_count}</td><td>{fmtHours(row.totals.worked_minutes)}</td><td>{fmtHours(row.totals.overtime_minutes)}</td><td><Stack direction="row" spacing={.6}>{row.cells.map(cell => <Box key={cell.date} title={`${fmtDate(cell.date)}: ${statusLabel(cell.status)} · ${fmtTime(cell.check_in_time)}–${fmtTime(cell.check_out_time)}`} sx={{ width: 24, height: 24, borderRadius: "6px", display: "grid", placeItems: "center", bgcolor: cell.status === "PRESENT" || cell.status === "ACTIVE" ? "#CFF4D8" : cell.status === "ABSENT" ? "#FCE0E3" : cell.status === "HALF_DAY" || cell.status === "LEAVE" ? "#FFF0B3" : cell.status === "WEEKEND" || cell.status === "HOLIDAY" ? "#CFE2FF" : "#F0F1F3", color: INK, fontSize: 9, cursor: canCorrect ? "pointer" : "default" }} onClick={() => canCorrect && openCorrection(row, cell)}>{new Date(`${cell.date}T12:00:00`).getDate()}</Box>)}</Stack></td></tr>)}{!report.rows.length && <tr><td colSpan={9} style={{ textAlign: "center", color: MUTED, padding: 28 }}>No attendance records match these filters.</td></tr>}</tbody></Box></Box><TablePagination component="div" count={report.total} page={Math.max(0, report.page - 1)} onPageChange={(_, nextPage) => setPage(nextPage + 1)} rowsPerPage={pageSize} onRowsPerPageChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} rowsPerPageOptions={[10, 25, 50]} sx={{ borderTop: `1px solid ${BORDER}`, '& .MuiTablePagination-toolbar': { fontFamily: FONT, minHeight: 52 }, '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontFamily: FONT, fontSize: 11, color: MUTED }, '& .MuiTablePagination-select': { fontFamily: FONT, fontSize: 12 } }} /></Paper>}
      </>}

      {!loading && activeTab === "settings" && policy && policyDraft && <>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderColor: BORDER, borderRadius: "14px", boxShadow: "none" }}>
          <SectionTitle title={editingPolicyId ? "Edit attendance policy" : "Attendance policy"} subtitle={editingPolicyId ? "Update this policy version" : "Create a new policy version"} icon={<SettingsRounded />} />
          <Stack spacing={2.5} sx={{ mt: 2.2 }}>
            <Box>
              <Typography sx={{ fontFamily: FONT, fontSize: 11, fontWeight: 750, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mb: 1.2 }}>Policy details</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" }, gap: 2 }}>
                <Field label="Policy name"><TextField size="small" fullWidth value={policyDraft.name || ""} onChange={e => setPolicyDraft(p => ({ ...p, name: e.target.value }))} sx={inputSx} /></Field>
                <Field label="Effective from"><TextField type="date" size="small" fullWidth value={policyEffectiveFrom} onChange={e => setPolicyEffectiveFrom(e.target.value)} sx={inputSx} required /></Field>
              </Box>
            </Box>
            <Divider sx={{ borderColor: BORDER }} />
            <Box>
              <Typography sx={{ fontFamily: FONT, fontSize: 11, fontWeight: 750, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mb: 1.2 }}>Working hours</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" }, gap: 2 }}>
                <Field label="Workday starts"><TextField type="time" size="small" fullWidth value={policyDraft.shift_start || "09:00"} onChange={e => setPolicyDraft(p => ({ ...p, shift_start: e.target.value }))} sx={inputSx} /></Field>
                <Field label="Workday ends"><TextField type="time" size="small" fullWidth value={policyDraft.shift_end || "17:00"} onChange={e => setPolicyDraft(p => ({ ...p, shift_end: e.target.value }))} sx={inputSx} /></Field>
              </Box>
            </Box>
            <Divider sx={{ borderColor: BORDER }} />
            <Box>
              <Typography sx={{ fontFamily: FONT, fontSize: 11, fontWeight: 750, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mb: 1.2 }}>Grace period</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" }, gap: 2 }}>
                <Field label="Check-in grace (minutes)"><TextField type="number" size="small" fullWidth value={policyDraft.grace_in_minutes ?? 0} onChange={e => setPolicyDraft(p => ({ ...p, grace_in_minutes: Number(e.target.value) }))} sx={inputSx} /></Field>
                <Field label="Check-out grace (minutes)"><TextField type="number" size="small" fullWidth value={policyDraft.grace_out_minutes ?? 0} onChange={e => setPolicyDraft(p => ({ ...p, grace_out_minutes: Number(e.target.value) }))} sx={inputSx} /></Field>
              </Box>
            </Box>
            <Divider sx={{ borderColor: BORDER }} />
            <Box>
              <Typography sx={{ fontFamily: FONT, fontSize: 11, fontWeight: 750, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mb: 1.2 }}>Attendance thresholds</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" }, gap: 2 }}>
                <Field label="Full-day hours"><TextField type="number" slotProps={{ htmlInput: { step: .25, min: .25, max: 24 } }} size="small" fullWidth value={policyDraft.full_day_hours ?? 8} onChange={e => setPolicyDraft(p => ({ ...p, full_day_hours: Number(e.target.value) }))} sx={inputSx} /></Field>
                <Field label="Half-day minimum hours"><TextField type="number" slotProps={{ htmlInput: { step: .25, min: .25, max: 24 } }} size="small" fullWidth value={policyDraft.half_day_hours ?? 4} onChange={e => setPolicyDraft(p => ({ ...p, half_day_hours: Number(e.target.value) }))} sx={inputSx} /></Field>
              </Box>
            </Box>
            <Divider sx={{ borderColor: BORDER }} />
            <Box>
              <Typography sx={{ fontFamily: FONT, fontSize: 11, fontWeight: 750, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mb: 1.2 }}>Overtime</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" }, gap: 2 }}>
                <Field label="Minimum overtime (minutes)"><TextField type="number" size="small" fullWidth value={policyDraft.overtime_min_minutes ?? 0} onChange={e => setPolicyDraft(p => ({ ...p, overtime_min_minutes: Number(e.target.value) }))} sx={inputSx} /></Field>
                <Field label="Overtime buffer (hours)"><TextField type="number" slotProps={{ htmlInput: { step: .25, min: 0, max: 24 } }} size="small" fullWidth value={policyDraft.overtime_buffer_hours ?? 0} onChange={e => setPolicyDraft(p => ({ ...p, overtime_buffer_hours: Number(e.target.value) }))} sx={inputSx} /></Field>
              </Box>
            </Box>
          </Stack>
          <Divider sx={{ my: 2.5, borderColor: BORDER }} />
          <Field label="Weekly offs"><Stack direction="row" spacing={.8} sx={{ flexWrap: "wrap" }}>{["MON","TUE","WED","THU","FRI","SAT","SUN"].map(day => {
            const selected = (policyDraft.weekly_offs || []).includes(day);
            return <Chip key={day} label={day} onClick={() => setPolicyDraft(p => ({ ...p, weekly_offs: selected ? (p.weekly_offs || []).filter(d => d !== day) : [...(p.weekly_offs || []), day] }))} sx={{ fontFamily: FONT, fontWeight: 650, bgcolor: selected ? INK : "#F3F3F1", color: selected ? "#fff" : INK, borderRadius: "8px", cursor: "pointer" }} />;
          })}</Stack></Field>
          <Stack direction="row" spacing={1} sx={{ mt: 3, justifyContent: "flex-end" }}>{editingPolicyId && <Button disabled={actionBusy} onClick={() => { setEditingPolicyId(null); setPolicyDraft(policy.current); setPolicyEffectiveFrom(addDays(policy.today, 1)); }} sx={{ fontFamily: FONT, textTransform: "none", color: MUTED }}>Cancel edit</Button>}<Button disabled={!canUpdatePolicy || actionBusy || !policyEffectiveFrom} onClick={() => void savePolicy()} variant="contained" sx={{ bgcolor: INK, textTransform: "none", fontFamily: FONT, borderRadius: "9px", px: 3, boxShadow: "none", "&:hover": { bgcolor: "#30333A", boxShadow: "none" } }}>{editingPolicyId ? "Save changes" : "Create policy"}</Button></Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2.5, borderColor: BORDER, borderRadius: "14px", boxShadow: "none" }}>
          <Typography sx={{ fontFamily: FONT, fontWeight: 700, color: INK, mb: 1.5 }}>Policy versions</Typography>
          <Stack spacing={1.25}>
            {[...(policy.upcoming || []), policy.current, ...(policy.past || []), ...(policy.inactive || [])]
              .sort((a, b) => b.effective_from.localeCompare(a.effective_from))
              .map(item => {
                const isDefault = item.name.trim().toLowerCase() === "default" || item.effective_from === "2000-01-01";
                const statusTone = item.status === "CURRENT"
                  ? { bg: "#E5F5ED", color: "#16734D", label: "ACTIVE NOW" }
                  : item.status === "UPCOMING"
                    ? { bg: "#EAF1FC", color: "#315F9B", label: "SCHEDULED" }
                    : { bg: "#F1F2F4", color: "#555B65", label: "PAST VERSION" };

                return <Box key={item.policy_id} sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) auto" },
                  gap: { xs: 1.5, md: 2 },
                  alignItems: "center",
                  p: { xs: 1.5, sm: 1.8 },
                  border: `1px solid ${BORDER}`,
                  borderRadius: "12px",
                  backgroundColor: "#FFFFFF",
                  transition: "border-color .15s ease, box-shadow .15s ease",
                  "&:hover": { borderColor: "#C9C9C4", boxShadow: "0 3px 12px rgba(20,20,20,.04)" },
                }}>
                  <Stack spacing={1.1} sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ minWidth: 0, flexWrap: "wrap", alignItems: "center" }}>
                      <Typography sx={{ fontFamily: FONT, fontWeight: 750, fontSize: 14, color: INK, minWidth: 0 }}>
                        {item.name}
                      </Typography>
                      <Chip label={statusTone.label} size="small" sx={{
                        height: 22, borderRadius: "6px", fontFamily: FONT, fontWeight: 750,
                        fontSize: 9.5, letterSpacing: ".035em", bgcolor: statusTone.bg,
                        color: statusTone.color, "& .MuiChip-label": { px: 1 },
                      }} />
                    </Stack>
                    <Box sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3,minmax(110px,max-content))" },
                      columnGap: { xs: 1.5, sm: 3 }, rowGap: 1,
                    }}>
                      <Box>
                        <Typography sx={{ fontFamily: FONT, fontSize: 10, color: MUTED, fontWeight: 650, mb: .25 }}>EFFECTIVE FROM</Typography>
                        <Typography sx={{ fontFamily: FONT, fontSize: 12, color: INK, fontWeight: 550 }}>{fmtDate(item.effective_from)}</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontFamily: FONT, fontSize: 10, color: MUTED, fontWeight: 650, mb: .25 }}>WORKING HOURS</Typography>
                        <Typography sx={{ fontFamily: FONT, fontSize: 12, color: INK, fontWeight: 550 }}>{item.shift_start} – {item.shift_end}</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontFamily: FONT, fontSize: 10, color: MUTED, fontWeight: 650, mb: .25 }}>POLICY TYPE</Typography>
                        <Typography sx={{ fontFamily: FONT, fontSize: 12, color: INK, fontWeight: 550 }}>{isDefault ? "System default" : "Custom policy"}</Typography>
                      </Box>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={.8} sx={{ alignItems: "center", justifyContent: { xs: "flex-start", md: "flex-end" }, flexWrap: "wrap", pt: { xs: 1, md: 0 }, borderTop: { xs: `1px solid ${BORDER}`, md: "none" } }}>
                    <Tooltip title={`Edit ${item.name}`}>
                      <span>
                        <IconButton size="small" disabled={!canUpdatePolicy || actionBusy} onClick={() => editPolicy(item)} sx={{
                          width: 34, height: 34, color: MUTED, bgcolor: "#FAFAF8",
                          border: `1px solid ${BORDER}`, borderRadius: "8px",
                          "&:hover": { color: INK, bgcolor: "#F1F1EE", borderColor: "#C8C8C2" },
                        }}>
                          <EditOutlined sx={{ fontSize: 17 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Button size="small" disabled={!canUpdatePolicy || actionBusy || item.status === "CURRENT"}
                      onClick={() => void togglePolicy(item)}
                      startIcon={<PowerSettingsNewRounded sx={{ fontSize: 15 }} />}
                      sx={{
                        minWidth: 112, height: 34, px: 1.35, fontFamily: FONT,
                        fontWeight: 700, fontSize: 11, textTransform: "none",
                        borderRadius: "8px",
                        border: `1px solid ${item.is_active ? "#F1C7CC" : "#BFE5D1"}`,
                        color: item.is_active ? "#A83240" : "#16734D",
                        bgcolor: item.is_active ? "#FFF8F8" : "#F3FAF6",
                        boxShadow: "none",
                        "&:hover": { bgcolor: item.is_active ? "#FDEEEF" : "#E7F5ED", boxShadow: "none" },
                      }}>
                      {item.status === "CURRENT" ? "Active" : "Schedule"}
                    </Button>
                    {!isDefault && <Button size="small" disabled={!canUpdatePolicy || actionBusy}
                      onClick={() => void deletePolicy(item)}
                      sx={{
                        minWidth: 62, height: 34, px: 1, fontFamily: FONT,
                        fontWeight: 650, fontSize: 11, textTransform: "none",
                        borderRadius: "8px", color: "#B42335",
                        "&:hover": { bgcolor: "#FFF1F2" },
                      }}>
                      Delete
                    </Button>}
                  </Stack>
                </Box>;
              })}
          </Stack>
        </Paper>
      </>}

      {!loading && !tabs.length && <Alert severity="info" sx={{ fontFamily: FONT }}>Your account does not currently have attendance permissions.</Alert>}
    </Stack>
    <Dialog open={Boolean(activationTarget)} onClose={() => !actionBusy && setActivationTarget(null)} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontFamily: FONT, fontWeight: 750 }}>Activate policy</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Typography sx={{ fontFamily: FONT, fontSize: 13, color: MUTED }}>{activationTarget?.name} will apply from the date you choose.</Typography>
          <TextField label="Active from" type="date" size="small" fullWidth value={activationDate} onChange={e => setActivationDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={inputSx} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={() => setActivationTarget(null)} disabled={actionBusy} sx={{ fontFamily: FONT, textTransform: "none", color: MUTED }}>Cancel</Button>
        <Button onClick={() => void confirmActivatePolicy()} disabled={actionBusy || !activationDate} variant="contained" sx={{ bgcolor: INK, fontFamily: FONT, textTransform: "none", boxShadow: "none" }}>Activate</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontFamily: FONT, fontWeight: 750 }}>Correct attendance</DialogTitle>
      <DialogContent>
        {editTarget && <Stack spacing={2} sx={{ pt: 1, minWidth: 0 }}>
          <Box sx={{ p: 1.5, borderRadius: "10px", bgcolor: "#F5F7FA", border: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontFamily: FONT, fontWeight: 700, color: INK, fontSize: 14 }}>{editTarget.employeeName}</Typography>
            <Typography sx={{ fontFamily: FONT, color: MUTED, fontSize: 12 }}>Attendance date: {fmtDate(editTarget.date)}</Typography>
          </Box>
          <FormControl size="small" fullWidth sx={inputSx}><InputLabel>Correction type</InputLabel><Select label="Correction type" value={correctionType} onChange={e => { const next = e.target.value as CorrectionType; setCorrectionType(next); if (next === "MISSED_CHECKOUT") setCorrectionScope("CHECK_OUT"); else if (correctionScope === "CHECK_OUT" && next === "MANUAL_ENTRY") setCorrectionScope("BOTH"); }}>{(["MISSED_CHECKOUT","WRONG_TIME","MANUAL_ENTRY"] as CorrectionType[]).map(t => <MenuItem key={t} value={t}>{t.replaceAll("_", " ")}</MenuItem>)}</Select></FormControl>
          {correctionType !== "MISSED_CHECKOUT" && <FormControl size="small" fullWidth sx={inputSx}><InputLabel>Fields to correct</InputLabel><Select label="Fields to correct" value={correctionScope} onChange={e => setCorrectionScope(e.target.value as "CHECK_IN" | "CHECK_OUT" | "BOTH")}>{[{ value: "CHECK_IN", label: "Check-in only" }, { value: "CHECK_OUT", label: "Check-out only" }, { value: "BOTH", label: "Check-in and check-out" }].map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}</Select></FormControl>}
          {correctionType !== "MISSED_CHECKOUT" && (correctionScope === "CHECK_IN" || correctionScope === "BOTH") && <TextField label="Correct check-in time" type="datetime-local" size="small" value={editIn} onChange={e => setEditIn(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={inputSx} fullWidth />}
          {(correctionType === "MISSED_CHECKOUT" || correctionScope === "CHECK_OUT" || correctionScope === "BOTH") && <TextField label={correctionType === "MISSED_CHECKOUT" ? "Actual check-out time" : "Correct check-out time"} type="datetime-local" size="small" value={editOut} onChange={e => setEditOut(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={inputSx} fullWidth />}
          <TextField label="Reason / note (optional)" placeholder="Briefly describe the correction" value={correctionReason} onChange={e => setCorrectionReason(e.target.value)} multiline minRows={2} maxRows={4} fullWidth sx={inputSx} />
          <Alert severity="info" sx={{ fontFamily: FONT, fontSize: 12 }}>Working hours and overtime are recalculated by the policy effective on this date. HR does not enter them manually.</Alert>
          <Button color="error" variant="outlined" onClick={() => setClearDay(true)} startIcon={<EventBusyRounded />} sx={{ alignSelf: "flex-start", textTransform: "none", fontFamily: FONT }}>{clearDay ? "Entire day's record will be cleared" : "Clear entire day's record"}</Button>
        </Stack>}
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={() => setEditTarget(null)} sx={{ fontFamily: FONT, textTransform: "none", color: MUTED }}>Cancel</Button>
        <Button disabled={actionBusy || (!clearDay && !editIn && !editOut)} onClick={() => void saveCorrection()} variant="contained" sx={{ bgcolor: INK, fontFamily: FONT, textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#30333A", boxShadow: "none" } }}>Save correction</Button>
      </DialogActions>
    </Dialog>
  </AppLayout>;
}
