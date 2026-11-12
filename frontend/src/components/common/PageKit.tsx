import type { ReactNode } from "react";
import { CloseRounded } from "@mui/icons-material";
import {
  Alert, Box, Button, Dialog, IconButton, DialogActions, DialogContent, DialogTitle, MenuItem,
  Paper, Stack, TextField, Typography, type ButtonProps, type SxProps, type Theme,
} from "@mui/material";

/**
 * Shared building blocks for the "time off" pages (Leave + Holidays).
 * Everything reads the app's --hrms-* CSS tokens, so light / dark mode both work
 * and the two pages can never drift apart again.
 */

export const FONT = "'Montserrat', sans-serif";

export const C = {
  ink: "var(--hrms-text, #16181D)",
  muted: "var(--hrms-muted, #6B6F76)",
  border: "var(--hrms-border-subtle, #ECEAE5)",
  borderStrong: "var(--hrms-border, #DAD7CF)",
  surface: "var(--hrms-surface, #FFFFFF)",
  surfaceAlt: "var(--hrms-surface-alt, #FAF9F6)",
  surfaceAlt2: "var(--hrms-surface-alt2, #F0EFEB)",
  hover: "var(--hrms-hover, rgba(0,0,0,.04))",
  primary: "var(--hrms-btn-primary-bg, #16181D)",
  primaryHover: "var(--hrms-btn-primary-hover, #2B2F38)",
  primaryText: "var(--hrms-btn-primary-text, #FFFFFF)",
};

/** Merge several sx values (objects, arrays, undefined) into one array-style sx. */
export const sxs = (...parts: (SxProps<Theme> | undefined | false)[]): SxProps<Theme> =>
  parts.flatMap((p) => (!p ? [] : Array.isArray(p) ? p : [p])) as SxProps<Theme>;

export type Tone = "success" | "warning" | "error" | "info" | "neutral";
const TONE: Record<Exclude<Tone, "neutral">, string> = {
  success: "#1E8E5A",
  warning: "#B7791F",
  error: "#C8402F",
  info: "#3A6EA5",
};

/* ------------------------------------------------------------------ */
/* Type scale – use these instead of ad-hoc font sizes                 */
/* ------------------------------------------------------------------ */
export const txt = {
  eyebrow: { fontFamily: FONT, fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted },
  pageTitle: { fontFamily: FONT, fontSize: 26, fontWeight: 700, letterSpacing: "-.5px", color: C.ink, lineHeight: 1.2 },
  pageSubtitle: { fontFamily: FONT, fontSize: 14, color: C.muted, mt: .75 },
  sectionTitle: { fontFamily: FONT, fontSize: 16, fontWeight: 700, color: C.ink },
  sectionSub: { fontFamily: FONT, fontSize: 12.5, color: C.muted, mt: .35 },
  rowTitle: { fontFamily: FONT, fontSize: 14, fontWeight: 650, color: C.ink },
  meta: { fontFamily: FONT, fontSize: 12.5, color: C.muted, mt: .4 },
  note: { fontFamily: FONT, fontSize: 12.5, color: C.ink, opacity: .8, mt: .5 },
  label: { fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.muted },
} satisfies Record<string, SxProps<Theme>>;

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */
export const fieldSx: SxProps<Theme> = {
  "& .MuiInputBase-root": { fontFamily: FONT, fontSize: 13.5, borderRadius: "10px", bgcolor: C.surface },
  "& .MuiInputLabel-root": { fontFamily: FONT, fontSize: 13.5 },
  "& .MuiFormHelperText-root": { fontFamily: FONT, fontSize: 12, mx: .25 },
};

const buttonBase: SxProps<Theme> = {
  textTransform: "none", fontFamily: FONT, fontSize: 13, fontWeight: 600,
  borderRadius: "10px", px: 1.75, py: .8, minHeight: 38, boxShadow: "none", whiteSpace: "nowrap",
  "&:hover": { boxShadow: "none" },
};

export function PrimaryButton({ sx, ...props }: ButtonProps) {
  return (
    <Button
      variant="contained"
      {...props}
      sx={sxs(buttonBase, { bgcolor: C.primary, color: C.primaryText, "&:hover": { bgcolor: C.primaryHover, boxShadow: "none" } }, sx)}
    />
  );
}

export function SecondaryButton({ sx, ...props }: ButtonProps) {
  return (
    <Button
      variant="outlined"
      {...props}
      sx={sxs(buttonBase, { color: C.ink, borderColor: C.borderStrong, bgcolor: C.surface, "&:hover": { bgcolor: C.hover, borderColor: C.muted } }, sx)}
    />
  );
}

/** Compact button used inside list rows (approve / reject / edit …). */
export const rowButtonSx: SxProps<Theme> = {
  textTransform: "none", fontFamily: FONT, fontSize: 12.5, fontWeight: 600,
  borderRadius: "9px", px: 1.4, minHeight: 32, boxShadow: "none",
};

export function YearSelect({ value, onChange, label = "Year" }: { value: number; onChange: (year: number) => void; label?: string }) {
  const now = new Date().getFullYear();
  const years = Array.from(new Set([...Array.from({ length: 7 }, (_, i) => now - 2 + i), value])).sort();
  return (
    <TextField select size="small" label={label} value={value} onChange={(e) => onChange(Number(e.target.value))} sx={sxs({ minWidth: 112 }, fieldSx)}>
      {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
    </TextField>
  );
}

/* ------------------------------------------------------------------ */
/* Page structure                                                      */
/* ------------------------------------------------------------------ */
export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 3, justifyContent: "space-between", alignItems: { md: "flex-end" } }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={txt.eyebrow}>{eyebrow}</Typography>
        <Typography component="h1" sx={{ ...txt.pageTitle, mt: .6 }}>{title}</Typography>
        <Typography sx={txt.pageSubtitle}>{subtitle}</Typography>
      </Box>
      {actions && <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>{actions}</Box>}
    </Stack>
  );
}

export function PageAlerts({ error, notice, onClearNotice }: { error?: string; notice?: string; onClearNotice?: () => void }) {
  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2, fontFamily: FONT, fontSize: 13, borderRadius: "10px" }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2, fontFamily: FONT, fontSize: 13, borderRadius: "10px" }} onClose={onClearNotice}>{notice}</Alert>}
    </>
  );
}

export function Surface({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Paper variant="outlined" sx={sxs({ borderRadius: "14px", borderColor: C.border, boxShadow: "none", bgcolor: C.surface, backgroundImage: "none", overflow: "hidden", minWidth: 0 }, sx)}>
      {children}
    </Paper>
  );
}

export function SectionHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ px: 2.5, py: 2, justifyContent: "space-between", alignItems: { sm: "center" }, borderBottom: `1px solid ${C.border}` }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={txt.sectionTitle}>{title}</Typography>
        {subtitle && <Typography sx={txt.sectionSub}>{subtitle}</Typography>}
      </Box>
      {children && <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>{children}</Box>}
    </Stack>
  );
}

/** Pill-style filter tabs that live inside a Surface (status filters etc.). */
export function FilterTabs<T extends string>({ value, onChange, options }: {
  value: T; onChange: (value: T) => void; options: { value: T; label: string; count?: number }[];
}) {
  return (
    <Box role="tablist" sx={{ display: "flex", flexWrap: "wrap", gap: 1, px: 2.5, py: 1.5, bgcolor: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Box
            key={o.value} component="button" type="button" role="tab" aria-selected={on} onClick={() => onChange(o.value)}
            sx={{
              display: "inline-flex", alignItems: "center", gap: .9, cursor: "pointer", height: 34, px: 1.5,
              borderRadius: "999px", fontFamily: FONT, fontSize: 13, fontWeight: 600,
              border: `1px solid ${on ? C.primary : C.borderStrong}`,
              bgcolor: on ? C.primary : C.surface, color: on ? C.primaryText : C.ink,
              transition: "background-color .15s, border-color .15s",
              "&:hover": { bgcolor: on ? C.primaryHover : C.hover },
            }}
          >
            {o.label}
            {o.count !== undefined && (
              <Box component="span" sx={{ minWidth: 20, height: 20, px: .7, borderRadius: "10px", display: "inline-grid", placeItems: "center", fontSize: 11.5, fontWeight: 700, bgcolor: on ? "rgba(255,255,255,.2)" : C.surfaceAlt2, color: on ? C.primaryText : C.muted }}>{o.count}</Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/** Row of summary cards – always the same grid on both pages. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 2, mb: 3 }}>{children}</Box>;
}

export function StatCard({ label, value, helper, icon, tone = "neutral" }: { label: string; value: ReactNode; helper: string; icon: ReactNode; tone?: Tone }) {
  const accent = tone === "neutral" ? undefined : TONE[tone];
  return (
    <Surface sx={{ p: 2.25 }}>
      <Stack direction="row" spacing={1.5} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={txt.label}>{label}</Typography>
          <Typography sx={{ fontFamily: FONT, fontSize: 28, fontWeight: 700, color: C.ink, lineHeight: 1.2, mt: .8, overflowWrap: "anywhere" }}>{value}</Typography>
          <Typography sx={{ fontFamily: FONT, fontSize: 12, color: C.muted, mt: .6 }}>{helper}</Typography>
        </Box>
        <Box sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: "11px", display: "grid", placeItems: "center", bgcolor: accent ? `${accent}1F` : C.surfaceAlt2, color: accent ?? C.ink }}>{icon}</Box>
      </Stack>
    </Surface>
  );
}

/* ------------------------------------------------------------------ */
/* List rows (used for leave requests, holidays, leave types …)        */
/* ------------------------------------------------------------------ */
export function RowList({ children }: { children: ReactNode }) {
  return <Box sx={{ "& > *:not(:last-child)": { borderBottom: `1px solid ${C.border}` } }}>{children}</Box>;
}

export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ px: 2.5, py: 1, bgcolor: C.surfaceAlt, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, "&:first-of-type": { borderTop: 0 } }}>
      <Typography sx={{ ...txt.eyebrow, fontSize: 11.5 }}>{children}</Typography>
    </Box>
  );
}

export function ListRow({ leading, title, badge, meta, note, actions }: {
  leading?: ReactNode; title: ReactNode; badge?: ReactNode; meta?: ReactNode; note?: ReactNode; actions?: ReactNode;
}) {
  return (
    <Box sx={{ display: "flex", flexWrap: { xs: "wrap", md: "nowrap" }, alignItems: "center", columnGap: 2, rowGap: 1.25, px: 2.5, py: 1.75, "&:hover": { bgcolor: C.hover } }}>
      {leading}
      <Box sx={{ minWidth: 0, flex: "1 1 240px" }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
          <Typography sx={txt.rowTitle}>{title}</Typography>
          {badge}
        </Box>
        {meta && <Typography sx={txt.meta}>{meta}</Typography>}
        {note && <Typography sx={txt.note}>{note}</Typography>}
      </Box>
      {actions && <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0, ml: { xs: "auto", md: 0 } }}>{actions}</Box>}
    </Box>
  );
}

/** Square calendar tile: MON / 12. Same tile for a holiday and for a leave request. */
export function DateBadge({ date }: { date: string }) {
  const d = new Date(`${date}T12:00:00`);
  return (
    <Box sx={{ width: 52, height: 52, flexShrink: 0, borderRadius: "12px", border: `1px solid ${C.borderStrong}`, bgcolor: C.surfaceAlt, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <Typography sx={{ fontFamily: FONT, fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", color: C.muted, textTransform: "uppercase", lineHeight: 1 }}>
        {d.toLocaleDateString("en-IN", { month: "short" })}
      </Typography>
      <Typography sx={{ fontFamily: FONT, fontSize: 19, fontWeight: 700, color: C.ink, lineHeight: 1.15, mt: .4 }}>
        {d.toLocaleDateString("en-IN", { day: "2-digit" })}
      </Typography>
    </Box>
  );
}

/** Same tile shape as DateBadge but carrying an icon (leave types, etc.). */
export function IconTile({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const accent = tone === "neutral" ? undefined : TONE[tone];
  return (
    <Box sx={{ width: 52, height: 52, flexShrink: 0, borderRadius: "12px", display: "grid", placeItems: "center", bgcolor: accent ? `${accent}1F` : C.surfaceAlt2, color: accent ?? C.ink }}>
      {children}
    </Box>
  );
}

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const color = tone === "neutral" ? C.muted : TONE[tone];
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", height: 24, px: 1.1, borderRadius: "7px",
      fontFamily: FONT, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", color,
      bgcolor: tone === "neutral" ? C.surfaceAlt2 : `${TONE[tone]}1F`,
    }}>{label}</Box>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <Box sx={{ minHeight: 240, display: "grid", placeItems: "center", textAlign: "center", px: 2.5, py: 5 }}>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Box sx={{ width: 52, height: 52, borderRadius: "14px", bgcolor: C.surfaceAlt2, color: C.ink, display: "grid", placeItems: "center", mb: 1.75 }}>{icon}</Box>
        <Typography sx={{ ...txt.sectionTitle, fontSize: 15 }}>{title}</Typography>
        {text && <Typography sx={{ ...txt.sectionSub, maxWidth: 360 }}>{text}</Typography>}
        {action && <Box sx={{ mt: 2 }}>{action}</Box>}
      </Box>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */
export function FormDialog({ open, onClose, title, subtitle, maxWidth = "sm", busy, busyLabel = "Saving…", submitLabel, submitIcon, submitDisabled, onSubmit, children }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; maxWidth?: "sm" | "md";
  busy?: boolean; busyLabel?: string; submitLabel: string; submitIcon?: ReactNode; submitDisabled?: boolean; onSubmit: () => void; children: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth={maxWidth} slotProps={{ paper: { sx: { borderRadius: "16px", backgroundImage: "none", bgcolor: C.surface } } }}>
      <DialogTitle sx={{ pb: 1.5, pr: 7, position: "relative" }}>
        <Typography component="span" sx={{ ...txt.sectionTitle, fontSize: 18, display: "block" }}>{title}</Typography>
        {subtitle && <Typography component="span" sx={{ ...txt.sectionSub, display: "block" }}>{subtitle}</Typography>}
        <IconButton aria-label="Close" onClick={onClose} disabled={busy} size="small" sx={{ position: "absolute", top: 14, right: 14, color: C.muted, border: `1px solid ${C.border}`, "&:hover": { bgcolor: C.hover, color: C.ink } }}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: "8px !important" }}>{children}</DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <SecondaryButton disabled={busy} onClick={onClose}>Cancel</SecondaryButton>
        <PrimaryButton disabled={busy || submitDisabled} onClick={onSubmit} startIcon={submitIcon}>{busy ? busyLabel : submitLabel}</PrimaryButton>
      </DialogActions>
    </Dialog>
  );
}
