import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, CircularProgress, IconButton, InputAdornment, Stack, TextField } from "@mui/material";
import {
  AddRounded, CalendarMonthRounded, DeleteOutlineRounded, EditOutlined, EventAvailableRounded,
  FileDownloadRounded, FileUploadRounded, RefreshRounded, SearchRounded, UpcomingRounded,
} from "@mui/icons-material";
import AppLayout from "../../components/layout/AppLayout";
import {
  C, DateBadge, EmptyState, FormDialog, GroupLabel, ListRow, PageAlerts, PageHeader, PrimaryButton,
  RowList, SecondaryButton, SectionHeader, StatCard, StatGrid, StatusPill, Surface, YearSelect, fieldSx, sxs,
} from "../../components/common/PageKit";
import api from "../../services/api";
import { canAny } from "../../utils/permissions";

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dateText = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", {
  weekday: "short", day: "2-digit", month: "short", year: "numeric",
});
const shortDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", {
  day: "2-digit", month: "short",
});
const monthText = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", {
  month: "long", year: "numeric",
});

type Holiday = {
  holiday_id: number;
  holiday_name: string;
  holiday_date: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};
type HolidayList = { items: Holiday[]; total: number; page: number; page_size: number };

export default function HolidayManagementPage() {
  const canManage = canAny("holiday.manage");
  const [year, setYear] = useState(new Date().getFullYear());
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [data, setData] = useState<HolidayList>({ items: [], total: 0, page: 1, page_size: 100 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ holiday_name: "", holiday_date: "", description: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const today = todayLocal();

  useEffect(() => {
    const handle = window.setTimeout(() => setAppliedQuery(query.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<HolidayList>("/holidays", {
        params: { year, q: appliedQuery || undefined, page: 1, page_size: 200 },
      });
      setData(response.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not load company holidays. Please refresh and try again.");
      setData({ items: [], total: 0, page: 1, page_size: 200 });
    } finally {
      setLoading(false);
    }
  }, [year, appliedQuery]);

  useEffect(() => { void load(); }, [load]);

  const sorted = useMemo(
    () => [...data.items].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)),
    [data.items],
  );
  const upcoming = useMemo(() => sorted.filter((h) => h.holiday_date >= today), [sorted, today]);
  const next = upcoming[0];
  const grouped = useMemo(() => {
    const groups = new Map<string, Holiday[]>();
    sorted.forEach((holiday) => {
      const key = holiday.holiday_date.slice(0, 7);
      groups.set(key, [...(groups.get(key) || []), holiday]);
    });
    return [...groups.entries()];
  }, [sorted]);

  const openEditor = (holiday?: Holiday) => {
    setEditingId(holiday?.holiday_id ?? null);
    setDraft({
      holiday_name: holiday?.holiday_name ?? "",
      holiday_date: holiday?.holiday_date ?? "",
      description: holiday?.description ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (editingId !== null) await api.patch(`/holidays/${editingId}`, draft);
      else await api.post("/holidays", draft);
      setDialogOpen(false);
      setNotice(editingId !== null ? "Holiday updated successfully." : "Holiday added successfully.");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not save holiday.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (holiday: Holiday) => {
    if (!window.confirm(`Delete ${holiday.holiday_name} on ${dateText(holiday.holiday_date)}?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.delete(`/holidays/${holiday.holiday_id}`);
      setNotice("Holiday deleted successfully.");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not delete holiday.");
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const csv = await file.text();
      const response = await api.post("/holidays/import", csv, {
        headers: { "Content-Type": "text/csv" },
      });
      setNotice(response.data?.message || "Holiday CSV imported successfully.");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not import CSV. Check the required columns and date format.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob(
      ["holiday_name,holiday_date,description\nRepublic Day,2027-01-26,National holiday\n"],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "holiday-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout pageTitle="Holiday Management">
      <Box sx={{ width: "100%", minWidth: 0 }}>
        <PageHeader
          eyebrow="Time off"
          title="Holiday Management"
          subtitle="View and manage your organization’s holidays and holiday calendar."
          actions={
            <>
              <SecondaryButton startIcon={<RefreshRounded />} disabled={loading || busy} onClick={() => void load()}>Refresh</SecondaryButton>
              <SecondaryButton startIcon={<FileDownloadRounded />} onClick={downloadTemplate}>CSV template</SecondaryButton>
              {canManage && (
                <>
                  <SecondaryButton startIcon={<FileUploadRounded />} disabled={busy} onClick={() => fileRef.current?.click()}>Import CSV</SecondaryButton>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => void importFile(event.target.files?.[0])} />
                  <PrimaryButton startIcon={<AddRounded />} disabled={busy} onClick={() => openEditor()}>Add holiday</PrimaryButton>
                </>
              )}
            </>
          }
        />

        <PageAlerts error={error} notice={notice} onClearNotice={() => setNotice("")} />

        <StatGrid>
          <StatCard label={`Holidays in ${year}`} value={data.total} helper="Company calendar entries" icon={<CalendarMonthRounded />} />
          <StatCard label="Upcoming" value={upcoming.length} helper="Today and future dates" icon={<UpcomingRounded />} tone="info" />
          <StatCard
            label="Next holiday"
            value={next ? shortDate(next.holiday_date) : "—"}
            helper={next ? next.holiday_name : "No upcoming holidays"}
            icon={<EventAvailableRounded />}
            tone="success"
          />
        </StatGrid>

        <Surface>
          <SectionHeader
            title="Company holidays"
            subtitle={canManage ? "Manage the dates that are excluded from leave calculations." : "View your organisation's holiday calendar."}
          >
            <TextField
              size="small"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by holiday name"
              sx={sxs({ width: { xs: "100%", sm: 240 } }, fieldSx)}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><SearchRounded sx={{ color: C.muted, fontSize: 18 }} /></InputAdornment>,
                },
              }}
            />
            <YearSelect value={year} onChange={setYear} />
          </SectionHeader>

          {loading ? (
            <Box sx={{ minHeight: 240, display: "grid", placeItems: "center" }}><CircularProgress size={26} /></Box>
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={<CalendarMonthRounded />}
              title={appliedQuery ? "No matching holidays" : `No holidays listed for ${year}`}
              text={appliedQuery ? "Try another search term or clear the search." : "Company holidays added for this calendar year will appear here."}
              action={canManage && !appliedQuery ? <PrimaryButton startIcon={<AddRounded />} onClick={() => openEditor()}>Add the first holiday</PrimaryButton> : undefined}
            />
          ) : (
            <Box>
              {grouped.map(([month, holidays]) => (
                <Box key={month}>
                  <GroupLabel>{monthText(`${month}-01`)}</GroupLabel>
                  <RowList>
                    {holidays.map((holiday) => (
                      <ListRow
                        key={holiday.holiday_id}
                        leading={<DateBadge date={holiday.holiday_date} />}
                        title={holiday.holiday_name}
                        badge={
                          holiday.holiday_date === today ? <StatusPill label="Today" tone="success" />
                            : holiday.holiday_date > today ? <StatusPill label="Upcoming" tone="info" /> : undefined
                        }
                        meta={dateText(holiday.holiday_date)}
                        note={holiday.description || undefined}
                        actions={canManage && (
                          <Stack direction="row" spacing={.5}>
                            <IconButton aria-label={`Edit ${holiday.holiday_name}`} size="small" onClick={() => openEditor(holiday)}><EditOutlined fontSize="small" /></IconButton>
                            <IconButton aria-label={`Delete ${holiday.holiday_name}`} size="small" color="error" onClick={() => void remove(holiday)}><DeleteOutlineRounded fontSize="small" /></IconButton>
                          </Stack>
                        )}
                      />
                    ))}
                  </RowList>
                </Box>
              ))}
            </Box>
          )}
        </Surface>
      </Box>

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingId !== null ? "Edit holiday" : "Add company holiday"}
        subtitle="Holidays are excluded from leave day calculations."
        busy={busy}
        submitLabel="Save holiday"
        submitDisabled={!draft.holiday_name.trim() || !draft.holiday_date}
        onSubmit={() => void save()}
      >
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField sx={fieldSx} label="Holiday name" fullWidth value={draft.holiday_name} onChange={(event) => setDraft((current) => ({ ...current, holiday_name: event.target.value }))} />
          <TextField sx={fieldSx} type="date" label="Date" slotProps={{ inputLabel: { shrink: true } }} fullWidth value={draft.holiday_date} onChange={(event) => setDraft((current) => ({ ...current, holiday_date: event.target.value }))} />
          <TextField sx={fieldSx} label="Description (optional)" multiline minRows={2} fullWidth value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
        </Stack>
      </FormDialog>
    </AppLayout>
  );
}
