import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { AddRounded, ArrowDropDownRounded, EditRounded, RefreshRounded, SearchRounded } from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import ActionToast from "../../components/common/ActionToast";
import StatusChip from "../../components/employees/StatusChip";
import api from "../../services/api";
import { can } from "../../utils/permissions";
import { getErrorMessage } from "../../utils/errors";
import { useThemeMode } from "../../contexts/ThemeModeContext";

const FONT = "'Montserrat', sans-serif";
type Kind = "departments" | "designations";
type RecordItem = { id: number; name: string; status: "ACTIVE" | "INACTIVE"; employee_count: number };
type Stats = { total: number; active: number; inactive: number };

export default function OrganizationManagement() {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode } = useThemeMode();
  const isDark = mode === "dark";
  const kind: Kind = location.pathname.endsWith("designations") ? "designations" : "departments";
  const singular = kind === "departments" ? "Department" : "Designation";
  const plural = `${singular}s`;
  const prefix = kind === "departments" ? "department" : "designation";
  const canCreate = can(`${prefix}.create`);
  const canUpdate = can(`${prefix}.update`);
  const canDeactivate = can(`${prefix}.deactivate`);

  const [rows, setRows] = useState<RecordItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortAsc, setSortAsc] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecordItem | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [a, b] = await Promise.all([
        api.get<RecordItem[]>(`/organization/${kind}`),
        api.get<Stats>(`/organization/${kind}/stats`),
      ]);
      setRows(a.data);
      setStats(b.data);
    } catch (e: unknown) {
      setError(getErrorMessage(e, `Unable to load ${plural.toLowerCase()}.`));
    } finally {
      setLoading(false);
    }
  }, [kind, plural]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return rows
      .filter(
        (r) =>
          r.name.toLowerCase().includes(query.trim().toLowerCase()) &&
          (statusFilter === "ALL" || r.status === statusFilter)
      )
      .sort((a, b) => a.name.localeCompare(b.name) * (sortAsc ? 1 : -1));
  }, [rows, query, statusFilter, sortAsc]);

  const pageRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (row: RecordItem) => {
    setEditing(row);
    setName(row.name);
    setError("");
    setDialogOpen(true);
  };

  const save = async () => {
    if (!name.trim()) {
      setError(`${singular} name is required.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.put(`/organization/${kind}/${editing.id}`, { name: name.trim() });
      } else {
        await api.post(`/organization/${kind}`, { name: name.trim() });
      }
      setDialogOpen(false);
      setToast(`${singular} ${editing ? "updated" : "created"} successfully.`);
      await load();
    } catch (e: unknown) {
      setError(getErrorMessage(e, `Unable to save ${singular.toLowerCase()}.`));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (row: RecordItem) => {
    if (togglingId === row.id) return;
    setTogglingId(row.id);
    setError("");
    try {
      const status = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await api.patch(`/organization/${kind}/${row.id}/status`, { status });
      setToast(`${singular} "${row.name}" ${status === "ACTIVE" ? "activated" : "deactivated"} successfully.`);
      await load();
    } catch (e: unknown) {
      setError(getErrorMessage(e, `Unable to update ${singular.toLowerCase()} status.`));
    } finally {
      setTogglingId(null);
    }
  };

  const dialogPaperSx = {
    borderRadius: "16px",
    backgroundColor: "var(--hrms-surface)",
    color: "var(--hrms-text)",
    backgroundImage: "none",
  };

  // Primary button: executive warm off-white in dark mode, crisp dark charcoal in light mode
  const primaryBtnSx = {
    backgroundColor: "var(--hrms-btn-primary-bg) !important",
    color: "var(--hrms-btn-primary-text) !important",
    textTransform: "none" as const,
    fontFamily: FONT,
    borderRadius: "10px",
    fontWeight: 650,
    fontSize: "13px",
    height: 40,
    px: 2.2,
    "&:hover": {
      backgroundColor: "var(--hrms-btn-primary-hover) !important",
      boxShadow: "none",
    },
    boxShadow: "none",
  };

  return (
    <AppLayout pageTitle="Org Management">
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Header */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Typography sx={{ fontFamily: FONT, fontSize: 26, fontWeight: 750, color: "var(--hrms-text)", letterSpacing: "-.7px" }}>
              Org Management
            </Typography>
            <Typography sx={{ fontFamily: FONT, color: "var(--hrms-muted)", fontSize: 13, mt: 0.5 }}>
              Manage departments and designations used across the organization.
            </Typography>
          </Box>
          <Button
            startIcon={<RefreshRounded />}
            onClick={() => void load()}
            sx={{
              color: "var(--hrms-text)",
              border: "1px solid var(--hrms-border)",
              borderRadius: "10px",
              textTransform: "none",
              fontFamily: FONT,
              "&:hover": { backgroundColor: "var(--hrms-hover)" },
            }}
          >
            Refresh
          </Button>
        </Box>

        {/* Tab Switcher */}
        <Box sx={{ display: "flex", gap: 1, p: 0.7, border: "1px solid var(--hrms-border)", background: "var(--hrms-surface)", borderRadius: "10px", width: "fit-content", maxWidth: "100%" }}>
          {(["departments", "designations"] as Kind[]).map((item) => (
            <Button
              key={item}
              onClick={() => {
                navigate(`/organization/${item}`);
                setPage(0);
              }}
              sx={{
                px: 2.2,
                py: 1,
                borderRadius: "7px",
                textTransform: "none",
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: kind === item ? 700 : 500,
                color: kind === item ? (isDark ? "#FFFFFF !important" : "#16181D !important") : "var(--hrms-muted)",
                background: kind === item ? (isDark ? "rgba(255,255,255,0.12)" : "rgba(22,24,29,0.07)") : "transparent",
                border: kind === item && isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
                "&:hover": { background: kind === item ? (isDark ? "rgba(255,255,255,0.16)" : "rgba(22,24,29,0.1)") : "var(--hrms-hover)" },
              }}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </Button>
          ))}
        </Box>

        {/* Stats Cards */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3,1fr)" }, gap: 2 }}>
          {[
            { label: `Total ${plural}`, value: stats?.total, color: "var(--hrms-text)" },
            { label: "Active", value: stats?.active, color: "#10b981" },
            { label: "Inactive", value: stats?.inactive, color: "#f87171" },
          ].map((c) => (
            <Box
              key={c.label}
              sx={{
                p: 2.3,
                border: "1px solid var(--hrms-border)",
                borderRadius: "16px",
                backgroundColor: "var(--hrms-surface)",
                transition: "transform 0.15s",
                "&:hover": { transform: "translateY(-1px)" },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: c.color }} />
                <Typography sx={{ fontFamily: FONT, fontSize: 12, color: "var(--hrms-muted)", fontWeight: 600 }}>{c.label}</Typography>
              </Box>
              <Typography sx={{ fontFamily: FONT, fontSize: 30, color: c.color, fontWeight: 750, lineHeight: 1 }}>{stats ? c.value : "—"}</Typography>
            </Box>
          ))}
        </Box>

        {error && !dialogOpen && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

        {/* Table Card */}
        <Box sx={{ border: "1px solid var(--hrms-border)", borderRadius: "16px", backgroundColor: "var(--hrms-surface)", overflow: "hidden" }}>
          {/* Filter Bar */}
          <Box sx={{ p: 2.2, display: "flex", alignItems: "center", gap: 1.5, justifyContent: "space-between", flexWrap: "wrap", borderBottom: "1px solid var(--hrms-border-subtle)" }}>
            <TextField
              size="small"
              placeholder={`Search ${plural.toLowerCase()}...`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              slotProps={{ input: { startAdornment: <SearchRounded sx={{ color: "var(--hrms-muted)", mr: 1, fontSize: 20 }} /> } }}
              sx={{
                minWidth: { xs: "100%", sm: 270 },
                "& .MuiInputBase-root": {
                  fontFamily: FONT,
                  fontSize: 13,
                  borderRadius: "10px",
                  backgroundColor: "var(--hrms-surface-alt)",
                  "& fieldset": { borderColor: "var(--hrms-border)" },
                },
              }}
            />
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
              <Select
                size="small"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE");
                  setPage(0);
                }}
                inputProps={{ "aria-label": "Filter by status" }}
                sx={{
                  minWidth: 140,
                  height: 40,
                  fontFamily: FONT,
                  fontSize: 13,
                  borderRadius: "10px",
                  backgroundColor: "var(--hrms-surface-alt)",
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--hrms-border)" },
                  "& .MuiSelect-select": { py: 1.1 },
                }}
              >
                <MenuItem value="ALL" sx={{ fontFamily: FONT, fontSize: 13 }}>All Status</MenuItem>
                <MenuItem value="ACTIVE" sx={{ fontFamily: FONT, fontSize: 13 }}>Active</MenuItem>
                <MenuItem value="INACTIVE" sx={{ fontFamily: FONT, fontSize: 13 }}>Inactive</MenuItem>
              </Select>
              {canCreate && (
                <Button startIcon={<AddRounded />} onClick={openCreate} sx={primaryBtnSx}>
                  Add {singular}
                </Button>
              )}
            </Box>
          </Box>

          <TableContainer sx={{ backgroundColor: "var(--hrms-surface)", borderRadius: 0 }}>
            <Table size="medium" sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow sx={{ backgroundColor: "var(--hrms-surface-alt)" }}>
                  <TableCell sx={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: "var(--hrms-muted)", borderBottomColor: "var(--hrms-border)" }}>
                    <TableSortLabel
                      active
                      direction={sortAsc ? "asc" : "desc"}
                      onClick={() => setSortAsc((v) => !v)}
                      IconComponent={ArrowDropDownRounded}
                      sx={{
                        flexDirection: "row",
                        gap: "3px",
                        "& .MuiTableSortLabel-icon": {
                          opacity: 1,
                          color: "var(--hrms-muted) !important",
                          margin: 0,
                          transform: sortAsc ? "rotate(0deg)" : "rotate(180deg)",
                        },
                      }}
                    >
                      {singular.toUpperCase()}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: "var(--hrms-muted)", borderBottomColor: "var(--hrms-border)" }}>
                    EMPLOYEES
                  </TableCell>
                  <TableCell sx={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: "var(--hrms-muted)", borderBottomColor: "var(--hrms-border)" }}>
                    STATUS
                  </TableCell>
                  {(canUpdate || canDeactivate) && (
                    <TableCell align="right" sx={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: "var(--hrms-muted)", borderBottomColor: "var(--hrms-border)", pr: 3 }}>
                      ACTIONS
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6, borderBottomColor: "var(--hrms-border)" }}>
                      <CircularProgress size={26} sx={{ color: "var(--hrms-text)" }} />
                    </TableCell>
                  </TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6, fontFamily: FONT, color: "var(--hrms-muted)", borderBottomColor: "var(--hrms-border)" }}>
                      No {plural.toLowerCase()} found.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((row) => {
                    const isActive = row.status === "ACTIVE";
                    const isToggling = togglingId === row.id;
                    const isBlocked = isActive && row.employee_count > 0;
                    const canToggle = canDeactivate && !isBlocked;

                    const tooltipText = !canDeactivate
                      ? "No permission to change status"
                      : isBlocked
                      ? `Cannot deactivate: ${row.employee_count} employee${row.employee_count > 1 ? "s" : ""} assigned`
                      : isActive
                      ? "Click to deactivate"
                      : "Click to activate";

                    return (
                      <TableRow hover key={row.id} sx={{ "& td": { borderColor: "var(--hrms-border-subtle)" }, "&:hover": { backgroundColor: "var(--hrms-hover)" } }}>
                        <TableCell sx={{ fontFamily: FONT, fontSize: 13, fontWeight: 650, color: "var(--hrms-text)" }}>
                          {row.name}
                        </TableCell>
                        <TableCell sx={{ fontFamily: FONT, fontSize: 13, color: "var(--hrms-muted)" }}>
                          {row.employee_count}
                        </TableCell>
                        <TableCell>
                          <Tooltip title={tooltipText} arrow placement="top">
                            <span>
                              <StatusChip
                                status={row.status}
                                onClick={canToggle ? () => void toggle(row) : undefined}
                              />
                            </span>
                          </Tooltip>
                        </TableCell>
                        {(canUpdate || canDeactivate) && (
                          <TableCell align="right" sx={{ pr: 3 }}>
                            <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1.5 }}>
                              {canDeactivate && (
                                <Tooltip title={tooltipText} arrow placement="top">
                                  <Box sx={{ display: "inline-flex", alignItems: "center" }}>
                                    {isToggling ? (
                                      <CircularProgress size={18} sx={{ color: "var(--hrms-muted)", mx: 1 }} />
                                    ) : (
                                      <Switch
                                        size="small"
                                        checked={isActive}
                                        onChange={() => void toggle(row)}
                                        disabled={!canToggle || isToggling}
                                        slotProps={{ input: { "aria-label": `Toggle status for ${row.name}` } }}
                                        sx={{
                                          "& .MuiSwitch-switchBase.Mui-checked": {
                                            color: "#10B981 !important",
                                          },
                                          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                            backgroundColor: "#10B981 !important",
                                            opacity: 0.6,
                                          },
                                        }}
                                      />
                                    )}
                                  </Box>
                                </Tooltip>
                              )}
                              {canUpdate && (
                                <Tooltip title={`Edit ${singular.toLowerCase()} name`} arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => openEdit(row)}
                                    aria-label={`Edit ${row.name}`}
                                    sx={{
                                      color: "var(--hrms-muted)",
                                      backgroundColor: "var(--hrms-surface-alt)",
                                      border: "1px solid var(--hrms-border)",
                                      borderRadius: "8px",
                                      p: 0.6,
                                      "&:hover": {
                                        color: "var(--hrms-text)",
                                        borderColor: "var(--hrms-text)",
                                        backgroundColor: "var(--hrms-hover)",
                                      },
                                    }}
                                  >
                                    <EditRounded sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_, v) => setPage(v)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25]}
            sx={{
              borderTop: `1px solid var(--hrms-border)`,
              backgroundColor: "var(--hrms-surface)",
              color: "var(--hrms-text)",
              "& .MuiTablePagination-selectLabel,& .MuiTablePagination-displayedRows": { fontFamily: FONT, fontSize: 12, color: "var(--hrms-muted)" },
              "& .MuiTablePagination-select": { fontFamily: FONT, fontSize: 12 },
            }}
          />
        </Box>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: dialogPaperSx } }}>
          <DialogTitle sx={{ fontFamily: FONT, fontWeight: 750, backgroundColor: "var(--hrms-surface)", color: "var(--hrms-text)" }}>
            {editing ? `Edit ${singular}` : `Add ${singular}`}
          </DialogTitle>
          <DialogContent sx={{ backgroundColor: "var(--hrms-surface)", color: "var(--hrms-text)" }}>
            <Typography sx={{ fontFamily: FONT, color: "var(--hrms-muted)", fontSize: 12, mb: 2 }}>
              Enter a clear, unique {singular.toLowerCase()} name.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              label={`${singular} name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
              }}
              slotProps={{ htmlInput: { maxLength: 120 } }}
              error={Boolean(error)}
              helperText={error}
              sx={{ "& input,& label,& p": { fontFamily: FONT } }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2.5, pt: 1, backgroundColor: "var(--hrms-surface)" }}>
            <Button onClick={() => setDialogOpen(false)} disabled={saving} sx={{ color: "var(--hrms-muted)", textTransform: "none", fontFamily: FONT }}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving || !name.trim()} variant="contained" sx={primaryBtnSx}>
              {saving ? "Saving..." : editing ? "Save Changes" : `Create ${singular}`}
            </Button>
          </DialogActions>
        </Dialog>

        <ActionToast open={Boolean(toast)} severity="success" message={toast} onClose={() => setToast("")} />
      </Box>
    </AppLayout>
  );
}
