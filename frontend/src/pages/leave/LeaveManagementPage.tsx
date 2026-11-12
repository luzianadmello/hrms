import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box, Checkbox, CircularProgress, FormControlLabel, IconButton, MenuItem, Stack, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import {
  AddRounded, BeachAccessRounded, CalendarMonthRounded, CheckCircleRounded, CloseRounded,
  DeleteOutlineRounded, EditOutlined, EventAvailableRounded, HourglassTopRounded, PaidRounded,
  RefreshRounded, SendRounded, MoneyOffRounded, InfoOutlined, WarningAmberRounded,
} from "@mui/icons-material";
import AppLayout from "../../components/layout/AppLayout";
import {
  C, DateBadge, EmptyState, FONT, FilterTabs, FormDialog, IconTile, ListRow, PageAlerts, PageHeader, PrimaryButton,
  RowList, SecondaryButton, SectionHeader, StatCard, StatGrid, StatusPill, Surface, YearSelect,
  fieldSx, rowButtonSx, sxs, txt, type Tone,
} from "../../components/common/PageKit";
import api from "../../services/api";
import { canAny } from "../../utils/permissions";

type LeaveType = { leave_type_id: number; leave_type_name: string; description: string | null; is_paid: boolean };
type LeaveRequest = { leave_id: number; employee_id: number; leave_type_id: number; start_date: string; end_date: string; days: string | number; reason: string; status: string; approved_by: number | null; approved_on: string | null };
type BalanceItem = { leave_type_id: number; leave_type_name: string; is_paid: boolean; allocated_days: string | number; used_days: string | number; remaining_days: string | number };
type BalanceGroup = { employee_id: number; employee_code: string; employee_name: string; year: number; leave_balances: BalanceItem[] };
type ListResponse<T> = { items: T[]; total: number; page: number; page_size: number };

const yearNow = new Date().getFullYear();
const fmtDate = (v: string) => new Date(`${v}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const n = (v: string | number) => Number(v || 0);
const days1 = (v: string | number) => n(v).toFixed(1);
const STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
const statusTone = (s: string): Tone => s === "APPROVED" ? "success" : s === "REJECTED" ? "error" : s === "CANCELLED" ? "neutral" : "warning";
const statusLabel = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** One balance card, used for both "my balance" and every employee in the all-balances view. */
function BalanceCard({ b }: { b: BalanceItem }) {
  const allocated = n(b.allocated_days);
  const pct = allocated ? Math.min(100, (n(b.used_days) / allocated) * 100) : 0;
  return (
    <Box sx={{ p: 2, borderRadius: "12px", border: `1px solid ${C.border}`, bgcolor: C.surfaceAlt, minWidth: 0 }}>
      <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography sx={txt.rowTitle}>{b.leave_type_name}</Typography>
        <StatusPill label={b.is_paid ? "Paid" : "Unpaid"} tone={b.is_paid ? "success" : "neutral"} />
      </Stack>
      <Typography sx={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, color: C.ink, mt: 1.25, lineHeight: 1.15 }}>
        {days1(b.remaining_days)}
        <Typography component="span" sx={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 500, color: C.muted, ml: .75 }}>days left</Typography>
      </Typography>
      <Box sx={{ height: 6, bgcolor: C.surfaceAlt2, borderRadius: 9, overflow: "hidden", my: 1.25 }}>
        <Box sx={{ height: "100%", width: `${pct}%`, bgcolor: C.ink, borderRadius: 9 }} />
      </Box>
      <Typography sx={{ fontFamily: FONT, fontSize: 12, color: C.muted }}>{days1(b.used_days)} used of {days1(b.allocated_days)} allocated</Typography>
    </Box>
  );
}

const balanceGridSx = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 1.5 };

export default function LeaveManagementPage() {
  const [searchParams] = useSearchParams();
  const requestedSection = searchParams.get("section");
  const canOwn = canAny("leave_request.view_own");
  const canApply = canAny("leave_request.apply");
  const canTeam = canAny("leave_request.view_team");
  const canAll = canAny("leave_request.view_all");
  const canReview = canAny("leave_request.review");
  const canCancel = canAny("leave_request.cancel");
  const canBalanceOwn = canAny("leave_balance.view_own");
  const canBalanceAll = canAny("leave_balance.view_all");
  const canManageBalance = canAny("leave_balance.manage");
  const canViewTypes = canAny("leave_type.view");
  const canManageTypes = canAny("leave_type.manage");
  const [tab, setTab] = useState(requestedSection === "balances" && (canBalanceOwn || canBalanceAll) ? "balances" : requestedSection === "types" && canManageTypes ? "types" : canOwn ? "requests" : canReview ? "approvals" : canAll ? "all" : canBalanceOwn || canBalanceAll ? "balances" : "types");
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [mine, setMine] = useState<LeaveRequest[]>([]);
  const [reviewItems, setReviewItems] = useState<LeaveRequest[]>([]);
  const [allItems, setAllItems] = useState<LeaveRequest[]>([]);
  const [myBalances, setMyBalances] = useState<BalanceGroup | null>(null);
  const [balanceGroups, setBalanceGroups] = useState<BalanceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [year, setYear] = useState(yearNow);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyDraft, setApplyDraft] = useState({ leave_type_id: "", start_date: "", end_date: "", reason: "", is_half_day: false });
  const [employeeId, setEmployeeId] = useState("");
  const [allocationDraft, setAllocationDraft] = useState<Record<number, string>>({});
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeDraft, setTypeDraft] = useState({ leave_type_name: "", description: "", is_paid: true });
  const [editingType, setEditingType] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const tasks: Promise<any>[] = [];
      if (canViewTypes) tasks.push(api.get<ListResponse<LeaveType>>("/leave-types").then(r => setTypes(r.data.items)));
      if (canOwn) tasks.push(api.get<ListResponse<LeaveRequest>>("/leave-requests/me", { params: { page: 1, page_size: 100 } }).then(r => setMine(r.data.items)).catch(() => setMine([])));
      if (canReview && canTeam && !canAll) tasks.push(api.get<ListResponse<LeaveRequest>>("/leave-requests/team", { params: { page: 1, page_size: 100 } }).then(r => setReviewItems(r.data.items)));
      if (canReview && canAll) tasks.push(api.get<ListResponse<LeaveRequest>>("/leave-requests", { params: { page: 1, page_size: 100 } }).then(r => { setReviewItems(r.data.items); setAllItems(r.data.items); }));
      else if (canAll) tasks.push(api.get<ListResponse<LeaveRequest>>("/leave-requests", { params: { page: 1, page_size: 100 } }).then(r => setAllItems(r.data.items)));
      if (canBalanceOwn) tasks.push(api.get<BalanceGroup>("/leave-balances/my", { params: { year } }).then(r => setMyBalances(r.data)).catch(() => setMyBalances(null)));
      if (canBalanceAll) tasks.push(api.get<ListResponse<BalanceGroup>>("/leave-balances", { params: { year, page: 1, page_size: 100 } }).then(r => setBalanceGroups(r.data.items)));
      await Promise.all(tasks);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not load leave management data.");
    } finally { setLoading(false); }
  }, [canViewTypes, canOwn, canReview, canTeam, canAll, canBalanceOwn, canBalanceAll, year]);

  useEffect(() => { void reload(); }, [reload]);

  const typeMap = useMemo(() => new Map(types.map(t => [t.leave_type_id, t])), [types]);
  const pendingCount = (canReview ? reviewItems : []).filter(r => r.status === "PENDING").length;
  const usedDays = (myBalances?.leave_balances || []).reduce((sum, b) => sum + n(b.used_days), 0);
  const remainingDays = (myBalances?.leave_balances || []).reduce((sum, b) => sum + n(b.remaining_days), 0);
  const tabRequests = tab === "approvals" ? reviewItems : tab === "all" ? allItems : mine;
  const visibleRequests = tabRequests.filter(r => statusFilter === "ALL" || r.status === statusFilter);
  const statusCount = (s: string) => s === "ALL" ? tabRequests.length : tabRequests.filter(r => r.status === s).length;

  // ---- Apply-for-leave: live calculations -------------------------------
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!applyOpen) return;
    let cancelled = false;
    Promise.all([yearNow, yearNow + 1].map(y => api.get<ListResponse<{ holiday_date: string }>>("/holidays", { params: { year: y, page: 1, page_size: 200 } }).then(r => r.data.items.map(h => h.holiday_date)).catch(() => [] as string[])))
      .then(lists => { if (!cancelled) setHolidayDates(new Set(lists.flat())); });
    return () => { cancelled = true; };
  }, [applyOpen]);

  const selectedType = typeMap.get(Number(applyDraft.leave_type_id));
  const selectedBalance = (myBalances?.leave_balances || []).find(b => b.leave_type_id === Number(applyDraft.leave_type_id));
  const effectiveEnd = applyDraft.is_half_day ? applyDraft.start_date : applyDraft.end_date;
  const span = useMemo(() => {
    if (!applyDraft.start_date || !effectiveEnd || effectiveEnd < applyDraft.start_date) return null;
    let calendar = 0, working = 0;
    const cur = new Date(`${applyDraft.start_date}T12:00:00`);
    const end = new Date(`${effectiveEnd}T12:00:00`);
    while (cur <= end && calendar < 400) {
      const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      calendar++;
      if (cur.getDay() !== 0 && cur.getDay() !== 6 && !holidayDates.has(iso)) working++;
      cur.setDate(cur.getDate() + 1);
    }
    return { calendar, working: applyDraft.is_half_day ? working * 0.5 : working };
  }, [applyDraft.start_date, effectiveEnd, applyDraft.is_half_day, holidayDates]);
  const remainingAfter = selectedBalance && span ? n(selectedBalance.remaining_days) - span.working : null;
  const overBalance = !!selectedType?.is_paid && remainingAfter !== null && remainingAfter < 0;

  const submitApplication = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      await api.post("/leave-requests", {
        leave_type_id: Number(applyDraft.leave_type_id),
        start_date: applyDraft.start_date,
        end_date: applyDraft.is_half_day ? applyDraft.start_date : applyDraft.end_date,
        reason: applyDraft.reason.trim(),
        is_half_day: applyDraft.is_half_day,
      });
      setApplyOpen(false); setApplyDraft({ leave_type_id: "", start_date: "", end_date: "", reason: "", is_half_day: false });
      setNotice("Your leave request has been submitted for review."); await reload();
    } catch (e: any) { setError(e?.response?.data?.detail || "Could not submit leave request."); }
    finally { setBusy(false); }
  };

  const review = async (id: number, status: "APPROVED" | "REJECTED") => {
    setBusy(true); setError(""); setNotice("");
    try { await api.patch(`/leave-requests/${id}/review`, { status }); setNotice(`Leave request ${status.toLowerCase()}.`); await reload(); }
    catch (e: any) { setError(e?.response?.data?.detail || "Could not update leave request."); }
    finally { setBusy(false); }
  };
  const deleteRequest = async (id: number) => {
    if (!window.confirm("Permanently delete this pending leave request? It will be removed from your request history and will not be sent for review.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api.delete(`/leave-requests/${id}`);
      setNotice("Pending leave request deleted.");
      await reload();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not delete leave request.");
    } finally { setBusy(false); }
  };

  const saveAllocation = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      await api.post("/leave-balances", {
        employee_id: Number(employeeId), year,
        allocations: types.map(t => ({ leave_type_id: t.leave_type_id, allocated_days: Number(allocationDraft[t.leave_type_id] ?? 0) })),
      });
      setNotice("Leave allocations saved. Used days were preserved."); setEmployeeId(""); setAllocationDraft({}); await reload();
    } catch (e: any) { setError(e?.response?.data?.detail || "Could not save leave allocations."); }
    finally { setBusy(false); }
  };

  const openTypeEditor = (t?: LeaveType) => {
    setEditingType(t?.leave_type_id ?? null);
    setTypeDraft({ leave_type_name: t?.leave_type_name ?? "", description: t?.description ?? "", is_paid: t?.is_paid ?? true });
    setTypeOpen(true);
  };
  const saveType = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (editingType) await api.patch(`/leave-types/${editingType}`, typeDraft);
      else await api.post("/leave-types", typeDraft);
      setTypeOpen(false); setNotice("Leave type saved."); await reload();
    } catch (e: any) { setError(e?.response?.data?.detail || "Could not save leave type."); }
    finally { setBusy(false); }
  };
  const deleteType = async (id: number) => {
    if (!window.confirm("Delete this leave type? Types linked to balances or requests cannot be deleted.")) return;
    setBusy(true); setError(""); setNotice("");
    try { await api.delete(`/leave-types/${id}`); setNotice("Leave type deleted."); await reload(); }
    catch (e: any) { setError(e?.response?.data?.detail || "Could not delete leave type."); }
    finally { setBusy(false); }
  };

  const tabs = [
    ...(canOwn ? [{ value: "requests", label: "My requests" }] : []),
    ...(canReview ? [{ value: "approvals", label: `Approvals${pendingCount ? ` (${pendingCount})` : ""}` }] : []),
    ...(canAll ? [{ value: "all", label: "All requests" }] : []),
    ...((canBalanceOwn || canBalanceAll) ? [{ value: "balances", label: canBalanceAll ? "Leave balances" : "My balance" }] : []),
    ...(canManageTypes ? [{ value: "types", label: "Leave types" }] : []),
  ];
  const activeTab = tabs.some(t => t.value === tab) ? tab : (tabs[0]?.value || "requests");
  const isRequestTab = activeTab === "requests" || activeTab === "approvals" || activeTab === "all";

  const requestTitle = activeTab === "approvals" ? "Requests awaiting your decision" : activeTab === "all" ? "Organization leave requests" : "Your leave history";
  const requestSub = activeTab === "approvals" ? "Approve or reject pending requests from your team." : activeTab === "all" ? "Every leave request across the organization." : "Everything you have applied for, with its current status.";

  const stats: ReactNode[] = [];
  if (canReview) stats.push(<StatCard key="pending" label="Pending approvals" value={pendingCount} helper="Requests waiting for your review" icon={<HourglassTopRounded />} tone="warning" />);
  if (canBalanceOwn) {
    stats.push(<StatCard key="used" label="Leave days used" value={days1(usedDays)} helper={`Your approved paid leave in ${year}`} icon={<CalendarMonthRounded />} />);
    stats.push(<StatCard key="left" label="Balance remaining" value={days1(remainingDays)} helper="Across your allocated paid leave types" icon={<PaidRounded />} tone="success" />);
  }

  return <AppLayout pageTitle="Leave Management"><Box sx={{ width: "100%", minWidth: 0 }}>
    <PageHeader
      eyebrow="Time off"
      title="Leave Management"
      subtitle="Manage leave requests, approvals, balances and leave types."
      actions={<>
        <SecondaryButton startIcon={<RefreshRounded />} disabled={loading || busy} onClick={() => void reload()}>Refresh</SecondaryButton>
        {canApply && <PrimaryButton startIcon={<AddRounded />} onClick={() => setApplyOpen(true)}>Apply for leave</PrimaryButton>}
      </>}
    />

    <PageAlerts error={error} notice={notice} onClearNotice={() => setNotice("")} />

    {stats.length > 0 && <StatGrid>{stats}</StatGrid>}

    <Surface>
      <Tabs
        value={activeTab}
        onChange={(_, v) => { setTab(v); setStatusFilter("ALL"); }}
        variant="scrollable" scrollButtons="auto"
        slotProps={{ indicator: { sx: { bgcolor: C.ink, height: 2.5 } } }}
        sx={{ px: 1.5, borderBottom: `1px solid ${C.border}`, "& .MuiTab-root": { textTransform: "none", fontFamily: FONT, fontWeight: 600, fontSize: 13.5, minHeight: 52, color: C.muted, "&.Mui-selected": { color: C.ink } } }}
      >
        {tabs.map(t => <Tab key={t.value} value={t.value} label={t.label} />)}
      </Tabs>

      {loading ? <Box sx={{ minHeight: 240, display: "grid", placeItems: "center" }}><CircularProgress size={26} /></Box> : <>

        {isRequestTab && <>
          <SectionHeader title={requestTitle} subtitle={requestSub} />
          <FilterTabs
            value={statusFilter}
            onChange={setStatusFilter}
            options={[{ value: "ALL", label: "All" }, ...STATUSES.map(st => ({ value: st, label: statusLabel(st) }))].map(o => ({ ...o, count: statusCount(o.value) }))}
          />
          {visibleRequests.length === 0
            ? <EmptyState icon={<EventAvailableRounded />} title="No leave requests to show" text={statusFilter === "ALL" ? "Leave requests will appear here once they are submitted." : `No ${statusLabel(statusFilter).toLowerCase()} requests. Try another tab.`} />
            : <RowList>
              {visibleRequests.map(r => {
                const lt = typeMap.get(r.leave_type_id);
                const canDecide = activeTab === "approvals" && canReview && r.status === "PENDING";
                const canDelete = activeTab === "requests" && canCancel && r.status === "PENDING";
                const range = `${fmtDate(r.start_date)}${r.start_date !== r.end_date ? ` – ${fmtDate(r.end_date)}` : ""}`;
                const who = activeTab === "requests" ? "" : ` · Employee #${r.employee_id}`;
                return <ListRow
                  key={r.leave_id}
                  leading={<DateBadge date={r.start_date} />}
                  title={lt?.leave_type_name || `Leave type #${r.leave_type_id}`}
                  badge={<StatusPill label={statusLabel(r.status)} tone={statusTone(r.status)} />}
                  meta={`${range} · ${days1(r.days)} day(s)${who} · Request #${r.leave_id}`}
                  note={r.reason}
                  actions={<>
                    {canDecide && <>
                      <PrimaryButton size="small" disabled={busy} startIcon={<CheckCircleRounded />} onClick={() => void review(r.leave_id, "APPROVED")} sx={sxs(rowButtonSx, { bgcolor: "#1E8E5A", color: "#fff", "&:hover": { bgcolor: "#177048" } })}>Approve</PrimaryButton>
                      <SecondaryButton size="small" disabled={busy} startIcon={<CloseRounded />} onClick={() => void review(r.leave_id, "REJECTED")} sx={sxs(rowButtonSx, { color: "#C8402F", borderColor: "#C8402F55", "&:hover": { borderColor: "#C8402F" } })}>Reject</SecondaryButton>
                    </>}
                    {canDelete && <SecondaryButton size="small" disabled={busy} startIcon={<DeleteOutlineRounded />} onClick={() => void deleteRequest(r.leave_id)} sx={sxs(rowButtonSx, { color: "#C8402F", borderColor: "#C8402F55", "&:hover": { borderColor: "#C8402F" } })}>Delete request</SecondaryButton>}
                  </>}
                />;
              })}
            </RowList>}
        </>}

        {activeTab === "balances" && <>
          <SectionHeader title="Leave balances" subtitle="Approved paid leave reduces your remaining balance.">
            <YearSelect value={year} onChange={setYear} label="Calendar year" />
          </SectionHeader>
          {canBalanceAll
            ? (balanceGroups.length === 0
              ? <EmptyState icon={<BeachAccessRounded />} title={`No leave allocations for ${year}`} text="Allocate leave to an employee below to get started." />
              : <RowList>{balanceGroups.map(group => <Box key={group.employee_id} sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: "baseline", mb: 1.5, flexWrap: "wrap" }}>
                  <Typography sx={txt.rowTitle}>{group.employee_name}</Typography>
                  <Typography sx={{ fontFamily: FONT, fontSize: 12.5, color: C.muted }}>{group.employee_code} · #{group.employee_id}</Typography>
                </Stack>
                <Box sx={balanceGridSx}>{group.leave_balances.map(b => <BalanceCard key={b.leave_type_id} b={b} />)}</Box>
              </Box>)}</RowList>)
            : ((myBalances?.leave_balances || []).length === 0
              ? <EmptyState icon={<BeachAccessRounded />} title={`No leave balance for ${year}`} text="Your leave allocation will appear here once HR assigns it." />
              : <Box sx={{ ...balanceGridSx, p: 2.5 }}>{(myBalances?.leave_balances || []).map(b => <BalanceCard key={b.leave_type_id} b={b} />)}</Box>)}
        </>}

        {activeTab === "balances" && canManageBalance && <Box sx={{ borderTop: `1px solid ${C.border}` }}>
          <SectionHeader title="Allocate leave for an employee" subtitle="Enter all configured leave types. Existing used days are preserved by the backend." />
          <Box sx={{ p: 2.5, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 1.5, alignItems: "end" }}>
            <TextField sx={fieldSx} size="small" type="number" label="Employee ID" value={employeeId} onChange={e => setEmployeeId(e.target.value)} />
            {types.map(t => <TextField sx={fieldSx} key={t.leave_type_id} size="small" type="number" label={`${t.leave_type_name} days`} value={allocationDraft[t.leave_type_id] ?? ""} onChange={e => setAllocationDraft(d => ({ ...d, [t.leave_type_id]: e.target.value }))} />)}
            <PrimaryButton disabled={busy || !employeeId || !types.length} onClick={() => void saveAllocation()}>Save allocation</PrimaryButton>
          </Box>
        </Box>}

        {activeTab === "types" && <>
          <SectionHeader title="Leave types" subtitle="Manage paid and unpaid leave categories.">
            <PrimaryButton startIcon={<AddRounded />} onClick={() => openTypeEditor()}>Add type</PrimaryButton>
          </SectionHeader>
          {types.length === 0
            ? <EmptyState icon={<BeachAccessRounded />} title="No leave types yet" text="Create the leave categories employees can apply for." action={<PrimaryButton startIcon={<AddRounded />} onClick={() => openTypeEditor()}>Add the first type</PrimaryButton>} />
            : <RowList>{types.map(t => <ListRow
              key={t.leave_type_id}
              leading={<IconTile tone={t.is_paid ? "success" : "neutral"}>{t.is_paid ? <PaidRounded /> : <MoneyOffRounded />}</IconTile>}
              title={t.leave_type_name}
              badge={<StatusPill label={t.is_paid ? "Paid" : "Unpaid"} tone={t.is_paid ? "success" : "neutral"} />}
              meta={t.description || "No description"}
              actions={<Stack direction="row" spacing={.5}>
                <IconButton aria-label={`Edit ${t.leave_type_name}`} size="small" onClick={() => openTypeEditor(t)}><EditOutlined fontSize="small" /></IconButton>
                <IconButton aria-label={`Delete ${t.leave_type_name}`} size="small" color="error" onClick={() => void deleteType(t.leave_type_id)}><DeleteOutlineRounded fontSize="small" /></IconButton>
              </Stack>}
            />)}</RowList>}
        </>}
      </>}
    </Surface>

    <FormDialog
      open={applyOpen} onClose={() => setApplyOpen(false)} maxWidth="md" busy={busy}
      title="Apply for leave" subtitle="Choose a leave category, dates and a reason for your request."
      busyLabel="Submitting…" submitLabel={span && span.working > 0 ? `Submit request · ${span.working} day${span.working === 1 ? "" : "s"}` : "Submit request"} submitIcon={<SendRounded />}
      submitDisabled={!applyDraft.leave_type_id || !applyDraft.start_date || !applyDraft.end_date || !applyDraft.reason.trim()}
      onSubmit={() => void submitApplication()}
    >
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "260px 1fr" }, gap: 2.5, pt: 1 }}>
        <Box sx={{ p: 2, borderRadius: "12px", border: `1px solid ${C.border}`, bgcolor: C.surfaceAlt, alignSelf: "start" }}>
          <Typography sx={{ ...txt.rowTitle, mb: 1 }}>Your leave balances</Typography>
          {(myBalances?.leave_balances || []).map(b => {
            const active = b.leave_type_id === Number(applyDraft.leave_type_id);
            return <Box key={b.leave_type_id} onClick={() => setApplyDraft(d => ({ ...d, leave_type_id: String(b.leave_type_id) }))} sx={{ p: 1.25, mx: -1.25, borderRadius: "10px", cursor: "pointer", border: `1px solid ${active ? C.ink : "transparent"}`, bgcolor: active ? C.surface : "transparent", opacity: applyDraft.leave_type_id && !active ? .6 : 1, transition: "all .15s", "&:hover": { opacity: 1 } }}>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography sx={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.ink }}>{b.leave_type_name}</Typography>
                <Typography sx={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: C.ink }}>{days1(b.remaining_days)} days</Typography>
              </Stack>
              <Typography sx={{ fontFamily: FONT, fontSize: 12, color: C.muted }}>{days1(b.used_days)} used of {days1(b.allocated_days)} allocated</Typography>
            </Box>;
          })}
          {!myBalances?.leave_balances?.length && <Typography sx={{ fontFamily: FONT, fontSize: 12.5, color: C.muted }}>No balance data available.</Typography>}
        </Box>
        <Stack spacing={2}>
          <TextField sx={fieldSx} select required label="Leave type" value={applyDraft.leave_type_id} onChange={e => setApplyDraft(d => ({ ...d, leave_type_id: e.target.value }))} fullWidth>
            {types.map(t => <MenuItem key={t.leave_type_id} value={t.leave_type_id}>{t.leave_type_name}{t.is_paid ? " · Paid" : " · Unpaid"}</MenuItem>)}
          </TextField>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
            <TextField sx={fieldSx} required type="date" label="From" slotProps={{ inputLabel: { shrink: true } }} fullWidth value={applyDraft.start_date} onChange={e => setApplyDraft(d => ({ ...d, start_date: e.target.value, end_date: d.end_date && d.end_date < e.target.value ? e.target.value : d.end_date }))} />
            <TextField sx={fieldSx} required type="date" label="To" slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: applyDraft.start_date } }} fullWidth disabled={applyDraft.is_half_day} value={applyDraft.is_half_day ? applyDraft.start_date : applyDraft.end_date} onChange={e => setApplyDraft(d => ({ ...d, end_date: e.target.value }))} />
          </Box>
          {span && <Box sx={{ p: 1.75, borderRadius: "12px", border: `1px solid ${overBalance ? "#B7791F66" : C.border}`, bgcolor: overBalance ? "#B7791F14" : C.surfaceAlt, display: "flex", gap: 1.25, alignItems: "flex-start" }}>
            <Box sx={{ color: overBalance ? "#B7791F" : C.muted, display: "grid", pt: .25 }}>{overBalance ? <WarningAmberRounded fontSize="small" /> : <InfoOutlined fontSize="small" />}</Box>
            <Box>
              <Typography sx={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 650, color: C.ink }}>
                {span.working} working day{span.working === 1 ? "" : "s"}{applyDraft.is_half_day ? " (half day)" : ""}
                {span.calendar - Math.ceil(span.working) > 0 && !applyDraft.is_half_day ? <Typography component="span" sx={{ fontFamily: FONT, fontSize: 12.5, color: C.muted, fontWeight: 500 }}> · {span.calendar - span.working} weekend/holiday day{span.calendar - span.working === 1 ? "" : "s"} excluded</Typography> : null}
              </Typography>
              {selectedBalance && remainingAfter !== null && <Typography sx={{ fontFamily: FONT, fontSize: 12.5, color: overBalance ? "#B7791F" : C.muted, mt: .35 }}>
                {overBalance ? `This is ${Math.abs(remainingAfter).toFixed(1)} day(s) more than your ${selectedBalance.leave_type_name} balance (${days1(selectedBalance.remaining_days)} left).` : `${days1(remainingAfter)} day(s) of ${selectedBalance.leave_type_name} will remain after this request.`}
              </Typography>}
              {span.working === 0 && <Typography sx={{ fontFamily: FONT, fontSize: 12.5, color: "#C8402F", mt: .35 }}>The selected dates fall only on weekends or holidays.</Typography>}
            </Box>
          </Box>}
          <FormControlLabel
            control={<Checkbox size="small" checked={applyDraft.is_half_day} onChange={e => setApplyDraft(d => ({ ...d, is_half_day: e.target.checked, end_date: e.target.checked ? d.start_date : d.end_date }))} />}
            label={<Typography sx={{ fontFamily: FONT, fontSize: 13.5 }}>Half-day leave</Typography>}
          />
          <TextField sx={fieldSx} required label="Reason" multiline minRows={3} value={applyDraft.reason} onChange={e => setApplyDraft(d => ({ ...d, reason: e.target.value }))} fullWidth helperText="Weekends and company holidays are excluded automatically." />
        </Stack>
      </Box>
    </FormDialog>

    <FormDialog
      open={typeOpen} onClose={() => setTypeOpen(false)} busy={busy}
      title={editingType ? "Edit leave type" : "Create leave type"} subtitle="Leave types decide what employees can apply for."
      submitLabel="Save leave type" submitDisabled={!typeDraft.leave_type_name.trim()}
      onSubmit={() => void saveType()}
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <TextField sx={fieldSx} label="Leave type name" fullWidth value={typeDraft.leave_type_name} onChange={e => setTypeDraft(d => ({ ...d, leave_type_name: e.target.value }))} />
        <TextField sx={fieldSx} label="Description" fullWidth multiline minRows={2} value={typeDraft.description} onChange={e => setTypeDraft(d => ({ ...d, description: e.target.value }))} />
        <TextField sx={fieldSx} select label="Payment" fullWidth value={String(typeDraft.is_paid)} onChange={e => setTypeDraft(d => ({ ...d, is_paid: e.target.value === "true" }))}>
          <MenuItem value="true">Paid</MenuItem>
          <MenuItem value="false">Unpaid (LWP)</MenuItem>
        </TextField>
      </Stack>
    </FormDialog>
  </Box></AppLayout>;
}
