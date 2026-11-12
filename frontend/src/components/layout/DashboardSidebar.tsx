import {
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import {
  CloseRounded,
  ChevronLeftRounded,
  DashboardRounded,
  GroupsRounded,
  AccessTimeRounded,
  BusinessRounded,
  ExpandMoreRounded,
  ChevronRightRounded as ChevronRightIcon,
  ApartmentRounded,
  WorkOutlineRounded,
  HistoryRounded,
  CalendarMonthRounded,
  SettingsRounded,
  BeachAccessRounded,
  EventAvailableRounded,
} from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import { canAny, getRoleLabel, isEmployeeView, isTeamViewOnly } from "../../utils/permissions";
import { useThemeMode } from "../../contexts/ThemeModeContext";

const FONT = "'Montserrat', sans-serif";
const INK = "#16181D";
const MUTED = "#6B6F76";
const BORDER = "#DAD7CF";

export const SIDEBAR_WIDTH = 260;
export const SIDEBAR_COLLAPSED_WIDTH = 76;

interface DashboardSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  userRoleName?: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function DashboardSidebar({
  mobileOpen,
  onMobileClose,
  userRoleName,
  collapsed,
  onToggleCollapse,
}: DashboardSidebarProps) {
  const theme = useTheme();
  const { mode } = useThemeMode();
  const isDark = mode === "dark";
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const isEmployee = isEmployeeView();
  const isManager = isTeamViewOnly();
  const compact = collapsed && !isMobile;
  const currentRoleLabel = userRoleName || getRoleLabel() || "Employee";
  const [organizationOpen, setOrganizationOpen] = useState(location.pathname.startsWith("/organization"));
  const [attendanceOpen, setAttendanceOpen] = useState(location.pathname.startsWith("/attendance"));
  const [leaveOpen, setLeaveOpen] = useState(location.pathname.startsWith("/leave"));
  const canViewOrganization = canAny("department.view", "designation.view");

  const handleNavClick = (path: string) => {
    navigate(path);
    if (isMobile) onMobileClose();
  };

  const baseNavItems = isEmployee
    ? [{ path: "/dashboard", label: "My Dashboard", icon: <DashboardRounded sx={{ fontSize: 20 }} /> }]
    : isManager
      ? [
          { path: "/dashboard", label: "Dashboard", icon: <DashboardRounded sx={{ fontSize: 20 }} /> },
          { path: "/employees", label: "My Team", icon: <GroupsRounded sx={{ fontSize: 20 }} /> },
        ]
      : [
          { path: "/dashboard", label: "Dashboard", icon: <DashboardRounded sx={{ fontSize: 20 }} /> },
          { path: "/employees", label: "Employees", icon: <GroupsRounded sx={{ fontSize: 20 }} /> },
        ];

  const navItems = [...baseNavItems];
  const canViewLeave = canAny(
    "leave_request.view_own", "leave_request.view_team", "leave_request.view_all",
    "leave_balance.view_own", "leave_balance.view_all", "leave_type.view",
  );
  const canViewHolidays = canAny("holiday.view");
  if (canViewHolidays) navItems.push({ path: "/holidays", label: "Holiday Management", icon: <EventAvailableRounded sx={{ fontSize: 20 }} /> });
  const canViewAttendance = canAny("attendance.view_own", "attendance.view_all", "attendance.view_policy");
  const attendanceChildren = [
    ...(canAny("attendance.view_own") ? [{ path: "/attendance/my-attendance", label: "My Attendance", icon: <HistoryRounded sx={{ fontSize: 17 }} /> }] : []),
    ...(canAny("attendance.view_all") ? [{ path: "/attendance/employees", label: "Employee Attendance", icon: <GroupsRounded sx={{ fontSize: 17 }} /> }, { path: "/attendance/reports", label: "Reports", icon: <CalendarMonthRounded sx={{ fontSize: 17 }} /> }] : []),
    ...(canAny("attendance.view_policy") ? [{ path: "/attendance/settings", label: "Settings", icon: <SettingsRounded sx={{ fontSize: 17 }} /> }] : []),
  ];
  const leaveChildren = [
    ...(canAny("leave_request.view_own", "leave_request.view_team", "leave_request.view_all") ? [{ path: "/leave", section: "requests", label: canAny("leave_request.view_own") ? "My Requests" : canAny("leave_request.review") ? "Approvals" : "Leave Requests", icon: <BeachAccessRounded sx={{ fontSize: 17 }} /> }] : []),
    ...(canAny("leave_balance.view_own", "leave_balance.view_all") ? [{ path: "/leave?section=balances", section: "balances", label: "Leave Balances", icon: <CalendarMonthRounded sx={{ fontSize: 17 }} /> }] : []),
    ...(canAny("leave_type.manage") ? [{ path: "/leave?section=types", section: "types", label: "Leave Types", icon: <SettingsRounded sx={{ fontSize: 17 }} /> }] : []),
  ];

  const sidebarContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        boxSizing: "border-box",
        backgroundColor: isDark ? "#2B2E35" : "#F8F8F7",
        color: isDark ? "#F3F4F6" : INK,
        borderRight: `1px solid ${isDark ? "#444852" : "#E2E2DE"}`,
        p: compact ? 1.25 : 2.5,
        overflowX: "hidden",
        transition: "padding 0.18s ease",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: compact ? "center" : "space-between",
          mb: 3.5,
          px: compact ? 0 : 1,
          gap: 1,
        }}
      >
        <Tooltip title={compact ? "Expand sidebar" : "Go to dashboard"} placement="right">
          <Box
            onClick={() => compact ? onToggleCollapse() : handleNavClick("/dashboard")}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => { if (compact && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onToggleCollapse(); } }}
            aria-label={compact ? "Expand sidebar" : "Go to dashboard"}
            sx={{ display: "flex", alignItems: "center", gap: 1.5, cursor: "pointer", minWidth: 0, outlineOffset: 3 }}
          >
          <Box
            sx={{
              width: 36,
              height: 36,
              flexShrink: 0,
              borderRadius: "10px",
              backgroundColor: INK,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "16px",
              boxShadow: "0 4px 12px rgba(22,24,29,0.2)",
            }}
          >H</Box>
          {!compact && (
            <Box>
              <Typography sx={{ fontFamily: FONT, fontSize: "16px", fontWeight: 700, color: isDark ? "#F3F4F6" : INK, letterSpacing: "-0.4px", lineHeight: 1.2 }}>
                HRMS
              </Typography>
              <Typography sx={{ fontFamily: FONT, fontSize: "11px", color: isDark ? "#A7ADB7" : MUTED, fontWeight: 500 }}>
                Workspace Portal
              </Typography>
            </Box>
          )}
          </Box>
        </Tooltip>

        {!isMobile && !compact && (
          <Tooltip title="Collapse sidebar">
            <IconButton
              onClick={onToggleCollapse}
              size="small"
              aria-label="Collapse sidebar"
              sx={{ color: isDark ? "#D4D8E0" : INK, border: `1px solid ${isDark ? "#414651" : BORDER}`, borderRadius: "8px", flexShrink: 0, width: 30, height: 30, "&:hover": { backgroundColor: isDark ? "#41454F" : "#F0F0ED" } }}
            >
              <ChevronLeftRounded sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
        {isMobile && (
          <IconButton onClick={onMobileClose} size="small" sx={{ color: isDark ? "#A7ADB7" : MUTED }} aria-label="Close navigation">
            <CloseRounded />
          </IconButton>
        )}
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", pr: 0.25 }}>
        <List disablePadding>
          {navItems.map((item) => {
            const active = item.path === "/dashboard"
              ? location.pathname === "/dashboard"
              : location.pathname.startsWith(item.path);
            const button = (
              <ListItemButton
                onClick={() => handleNavClick(item.path)}
                sx={{
                  minHeight: 43,
                  borderRadius: "10px",
                  py: 1.05,
                  px: compact ? 1.3 : 1.55,
                  justifyContent: compact ? "center" : "flex-start",
                  backgroundColor: active
                    ? (isDark ? "rgba(255, 255, 255, 0.12)" : INK)
                    : "transparent",
                  color: active
                    ? "#FFFFFF"
                    : (isDark ? "#A7ADB7" : MUTED),
                  border: active && isDark ? "1px solid rgba(255, 255, 255, 0.14)" : "1px solid transparent",
                  transition: "background-color 160ms ease, color 160ms ease, transform 160ms ease",
                  "&:hover": {
                    backgroundColor: active
                      ? (isDark ? "rgba(255, 255, 255, 0.16)" : "#30333A")
                      : (isDark ? "rgba(255, 255, 255, 0.06)" : "#F0F0ED"),
                    color: isDark ? "#FFFFFF" : INK,
                    transform: "translateX(1px)",
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: compact ? 0 : 34, justifyContent: "center", color: active ? "#FFFFFF !important" : (isDark ? "#A7ADB7 !important" : `${MUTED} !important`) }}>
                  {item.icon}
                </ListItemIcon>
                {!compact && (
                  <ListItemText
                    primary={
                      <Typography sx={{ fontFamily: FONT, fontSize: "13px", fontWeight: active ? 650 : 500, color: "inherit !important" }}>
                        {item.label}
                      </Typography>
                    }
                  />
                )}
              </ListItemButton>
            );
            return (
              <ListItem key={item.path} disablePadding sx={{ mb: 0.8 }}>
                {compact ? <Tooltip title={item.label} placement="right">{button}</Tooltip> : button}
              </ListItem>
            );
          })}
          {canViewLeave && (
            <>
              <ListItem disablePadding sx={{ mb: 0.6 }}>
                <ListItemButton
                  onClick={() => compact ? handleNavClick("/leave") : setLeaveOpen((open) => !open)}
                  sx={{
                    minHeight: 43, borderRadius: "10px", py: 1.05, px: compact ? 1.3 : 1.55,
                    justifyContent: compact ? "center" : "flex-start",
                    backgroundColor: location.pathname.startsWith("/leave") ? (isDark ? "rgba(255, 255, 255, 0.12)" : INK) : "transparent",
                    color: location.pathname.startsWith("/leave") ? "#FFFFFF" : (isDark ? "#A7ADB7" : MUTED),
                    border: location.pathname.startsWith("/leave") && isDark ? "1px solid rgba(255, 255, 255, 0.14)" : "1px solid transparent",
                    transition: "background-color 160ms ease, color 160ms ease",
                    "&:hover": { backgroundColor: location.pathname.startsWith("/leave") ? (isDark ? "rgba(255, 255, 255, 0.16)" : "#30333A") : (isDark ? "rgba(255, 255, 255, 0.06)" : "#F0F0ED"), color: isDark ? "#FFFFFF" : INK },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: compact ? 0 : 34, justifyContent: "center", color: location.pathname.startsWith("/leave") ? "#FFFFFF !important" : (isDark ? "#A7ADB7 !important" : `${MUTED} !important`) }}><BeachAccessRounded sx={{ fontSize: 20 }} /></ListItemIcon>
                  {!compact && <>
                    <ListItemText primary={<Typography sx={{ fontFamily: FONT, fontSize: 13, fontWeight: location.pathname.startsWith("/leave") ? 650 : 500, color: "inherit !important" }}>Leave Management</Typography>} />
                    {leaveOpen ? <ExpandMoreRounded sx={{ color: "inherit" }} /> : <ChevronRightIcon sx={{ color: "inherit" }} />}
                  </>}
                </ListItemButton>
              </ListItem>
              {leaveOpen && !compact && (
                <Box sx={{ ml: 3.6, pl: 1.2, borderLeft: `1px solid ${isDark ? "#3E434D" : BORDER}`, mb: 1 }}>
                  {leaveChildren.map((child) => {
                    const selected = child.section === "balances" ? location.search.includes("section=balances") : child.section === "types" ? location.search.includes("section=types") : location.pathname === "/leave" && !location.search;
                    return <ListItem key={child.section} disablePadding sx={{ mb: 0.4 }}>
                      <ListItemButton onClick={() => handleNavClick(child.path)} sx={{ minHeight: 38, borderRadius: "8px", px: 1.4, backgroundColor: selected ? (isDark ? "rgba(255,255,255,0.10)" : "#E8E7E3") : "transparent", color: selected ? (isDark ? "#FFFFFF" : INK) : (isDark ? "#A7ADB7" : MUTED), "&:hover": { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#F0F0ED", color: isDark ? "#FFFFFF" : INK } }}>
                        <ListItemIcon sx={{ minWidth: 28, color: "inherit" }}>{child.icon}</ListItemIcon>
                        <ListItemText primary={<Typography sx={{ fontFamily: FONT, fontSize: 12, fontWeight: selected ? 700 : 500, color: "inherit !important" }}>{child.label}</Typography>} />
                      </ListItemButton>
                    </ListItem>;
                  })}
                </Box>
              )}
            </>
          )}
          {canViewAttendance && (
            <>
              <ListItem disablePadding sx={{ mb: 0.6 }}>
                <ListItemButton
                  onClick={() => compact ? handleNavClick(attendanceChildren[0]?.path || "/attendance/my-attendance") : setAttendanceOpen((open) => !open)}
                  sx={{
                    minHeight: 43, borderRadius: "10px", py: 1.05, px: compact ? 1.3 : 1.55,
                    justifyContent: compact ? "center" : "flex-start",
                    backgroundColor: location.pathname.startsWith("/attendance") ? (isDark ? "rgba(255, 255, 255, 0.12)" : INK) : "transparent",
                    color: location.pathname.startsWith("/attendance") ? "#FFFFFF" : (isDark ? "#A7ADB7" : MUTED),
                    border: location.pathname.startsWith("/attendance") && isDark ? "1px solid rgba(255, 255, 255, 0.14)" : "1px solid transparent",
                    transition: "background-color 160ms ease, color 160ms ease",
                    "&:hover": { backgroundColor: location.pathname.startsWith("/attendance") ? (isDark ? "rgba(255, 255, 255, 0.16)" : "#30333A") : (isDark ? "rgba(255, 255, 255, 0.06)" : "#F0F0ED"), color: isDark ? "#FFFFFF" : INK },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: compact ? 0 : 34, justifyContent: "center", color: location.pathname.startsWith("/attendance") ? "#FFFFFF !important" : (isDark ? "#A7ADB7 !important" : `${MUTED} !important`) }}><AccessTimeRounded sx={{ fontSize: 20 }} /></ListItemIcon>
                  {!compact && <>
                    <ListItemText primary={<Typography sx={{ fontFamily: FONT, fontSize: 13, fontWeight: location.pathname.startsWith("/attendance") ? 650 : 500, color: "inherit !important" }}>Attendance</Typography>} />
                    {attendanceOpen ? <ExpandMoreRounded sx={{ color: "inherit" }} /> : <ChevronRightIcon sx={{ color: "inherit" }} />}
                  </>}
                </ListItemButton>
              </ListItem>
              {attendanceOpen && !compact && (
                <Box sx={{ ml: 3.6, pl: 1.2, borderLeft: `1px solid ${isDark ? "#3E434D" : BORDER}`, mb: 1 }}>
                  {attendanceChildren.map((child) => {
                    const selected = location.pathname === child.path || (child.path === "/attendance/my-attendance" && location.pathname === "/attendance");
                    return <ListItem key={child.path} disablePadding sx={{ mb: 0.4 }}>
                      <ListItemButton onClick={() => handleNavClick(child.path)} sx={{ minHeight: 38, borderRadius: "8px", px: 1.4, backgroundColor: selected ? (isDark ? "rgba(255,255,255,0.10)" : "#E8E7E3") : "transparent", color: selected ? (isDark ? "#FFFFFF" : INK) : (isDark ? "#A7ADB7" : MUTED), "&:hover": { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#F0F0ED", color: isDark ? "#FFFFFF" : INK } }}>
                        <ListItemIcon sx={{ minWidth: 28, color: "inherit" }}>{child.icon}</ListItemIcon>
                        <ListItemText primary={<Typography sx={{ fontFamily: FONT, fontSize: 12, fontWeight: selected ? 700 : 500, color: "inherit !important" }}>{child.label}</Typography>} />
                      </ListItemButton>
                    </ListItem>;
                  })}
                </Box>
              )}
            </>
          )}
          {canViewOrganization && !isEmployee && !isManager && (
            <>
              <ListItem disablePadding sx={{ mb: 0.6 }}>
                <ListItemButton
                  onClick={() => setOrganizationOpen((open) => !open)}
                  sx={{
                    minHeight: 43,
                    borderRadius: "10px",
                    py: 1.05,
                    px: compact ? 1.3 : 1.55,
                    justifyContent: compact ? "center" : "flex-start",
                    backgroundColor: location.pathname.startsWith("/organization")
                      ? (isDark ? "rgba(255, 255, 255, 0.12)" : INK)
                      : "transparent",
                    color: location.pathname.startsWith("/organization")
                      ? "#FFFFFF"
                      : (isDark ? "#A7ADB7" : MUTED),
                    border: location.pathname.startsWith("/organization") && isDark
                      ? "1px solid rgba(255, 255, 255, 0.14)"
                      : "1px solid transparent",
                    transition: "background-color 160ms ease, color 160ms ease",
                    "&:hover": {
                      backgroundColor: location.pathname.startsWith("/organization")
                        ? (isDark ? "rgba(255, 255, 255, 0.16)" : "#30333A")
                        : (isDark ? "rgba(255, 255, 255, 0.06)" : "#F0F0ED"),
                      color: isDark ? "#FFFFFF" : INK,
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: compact ? 0 : 34, justifyContent: "center", color: location.pathname.startsWith("/organization") ? "#FFFFFF !important" : (isDark ? "#A7ADB7 !important" : `${MUTED} !important`) }}>
                    <BusinessRounded sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  {!compact && (
                    <>
                      <ListItemText
                        primary={
                          <Typography sx={{ fontFamily: FONT, fontSize: 13, fontWeight: location.pathname.startsWith("/organization") ? 650 : 500, color: "inherit !important" }}>
                            Org Management
                          </Typography>
                        }
                      />
                      {organizationOpen ? (
                        <ExpandMoreRounded sx={{ color: "inherit" }} />
                      ) : (
                        <ChevronRightIcon sx={{ color: "inherit" }} />
                      )}
                    </>
                  )}
                </ListItemButton>
              </ListItem>
              {organizationOpen && !compact && (
                <Box sx={{ ml: 3.6, pl: 1.2, borderLeft: `1px solid ${isDark ? "#3E434D" : BORDER}`, mb: 1 }}>
                  {canAny("department.view", "department.create", "department.update", "department.deactivate") && (
                    <ListItem disablePadding sx={{ mb: 0.4 }}>
                      <ListItemButton
                        onClick={() => handleNavClick("/organization/departments")}
                        sx={{
                          minHeight: 38,
                          borderRadius: "8px",
                          px: 1.4,
                          backgroundColor: location.pathname === "/organization/departments"
                            ? (isDark ? "rgba(255, 255, 255, 0.10)" : "#E8E7E3")
                            : "transparent",
                          color: location.pathname === "/organization/departments"
                            ? (isDark ? "#FFFFFF" : INK)
                            : (isDark ? "#A7ADB7" : MUTED),
                          "&:hover": {
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F0F0ED",
                            color: isDark ? "#FFFFFF" : INK,
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 28, color: "inherit" }}>
                          <ApartmentRounded sx={{ fontSize: 17 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography sx={{ fontFamily: FONT, fontSize: 12, fontWeight: location.pathname === "/organization/departments" ? 700 : 500, color: "inherit !important" }}>
                              Departments
                            </Typography>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  )}
                  {canAny("designation.view", "designation.create", "designation.update", "designation.deactivate") && (
                    <ListItem disablePadding sx={{ mb: 0.4 }}>
                      <ListItemButton
                        onClick={() => handleNavClick("/organization/designations")}
                        sx={{
                          minHeight: 38,
                          borderRadius: "8px",
                          px: 1.4,
                          backgroundColor: location.pathname === "/organization/designations"
                            ? (isDark ? "rgba(255, 255, 255, 0.10)" : "#E8E7E3")
                            : "transparent",
                          color: location.pathname === "/organization/designations"
                            ? (isDark ? "#FFFFFF" : INK)
                            : (isDark ? "#A7ADB7" : MUTED),
                          "&:hover": {
                            backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F0F0ED",
                            color: isDark ? "#FFFFFF" : INK,
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 28, color: "inherit" }}>
                          <WorkOutlineRounded sx={{ fontSize: 17 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography sx={{ fontFamily: FONT, fontSize: 12, fontWeight: location.pathname === "/organization/designations" ? 700 : 500, color: "inherit !important" }}>
                              Designations
                            </Typography>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  )}
                </Box>
              )}
            </>
          )}
        </List>
      </Box>

      <Box sx={{ pt: 2 }}>
        <Divider sx={{ mb: 2, borderColor: isDark ? "#444852" : "#E2E2DE" }} />
        {!compact && (
          <Box sx={{ p: 1.5, borderRadius: "12px", backgroundColor: isDark ? "#30343C" : "#FFFFFF", border: `1px solid ${isDark ? "#444852" : "#E2E2DE"}`, display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontFamily: FONT, fontSize: "11px", color: isDark ? "#A7ADB7" : MUTED, fontWeight: 500 }}>Current Role</Typography>
              <Typography sx={{ fontFamily: FONT, fontSize: "13px", fontWeight: 700, color: isDark ? "#F3F4F6" : INK }}>{currentRoleLabel}</Typography>
            </Box>
            <Chip label="Active" size="small" sx={{ fontFamily: FONT, fontSize: "10px", fontWeight: 700, height: 20, backgroundColor: "rgba(16,185,129,0.12)", color: "#059669" }} />
          </Box>
        )}

      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{ "& .MuiDrawer-paper": { boxSizing: "border-box", width: SIDEBAR_WIDTH, backgroundColor: isDark ? "#2B2E35" : "#F8F8F7" } }}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  return (
    <Box
      component="nav"
      sx={{
        width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        flexShrink: 0,
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 100,
        transition: "width 0.18s ease",
      }}
    >
      {sidebarContent}
    </Box>
  );
}
