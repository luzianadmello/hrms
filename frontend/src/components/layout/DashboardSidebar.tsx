import {
  Box,
  Button,
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
import {
  CloseRounded,
  ChevronLeftRounded,
  ChevronRightRounded,
  DashboardRounded,
  GroupsRounded,
  LogoutRounded,
} from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import { getRoleLabel, isEmployeeView, isTeamViewOnly } from "../../utils/permissions";

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
  onLogout: () => void;
  loggingOut?: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function DashboardSidebar({
  mobileOpen,
  onMobileClose,
  userRoleName,
  onLogout,
  loggingOut = false,
  collapsed,
  onToggleCollapse,
}: DashboardSidebarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const isEmployee = isEmployeeView();
  const isManager = isTeamViewOnly();
  const compact = collapsed && !isMobile;
  const currentRoleLabel = userRoleName || getRoleLabel() || "Employee";

  const handleNavClick = (path: string) => {
    navigate(path);
    if (isMobile) onMobileClose();
  };

  const navItems = isEmployee
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

  const sidebarContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        boxSizing: "border-box",
        backgroundColor: "#FAF9F6",
        borderRight: `1px solid ${BORDER}`,
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
        <Box
          onClick={() => handleNavClick("/dashboard")}
          sx={{ display: "flex", alignItems: "center", gap: 1.5, cursor: "pointer", minWidth: 0 }}
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
              <Typography sx={{ fontFamily: FONT, fontSize: "16px", fontWeight: 700, color: INK, letterSpacing: "-0.4px", lineHeight: 1.2 }}>
                HRMS
              </Typography>
              <Typography sx={{ fontFamily: FONT, fontSize: "11px", color: MUTED, fontWeight: 500 }}>
                Workspace Portal
              </Typography>
            </Box>
          )}
        </Box>

        {!isMobile && (
          <Tooltip title={compact ? "Expand sidebar" : "Collapse sidebar"}>
            <IconButton
              onClick={onToggleCollapse}
              size="small"
              aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
              sx={{ color: INK, border: `1px solid ${BORDER}`, borderRadius: "8px", flexShrink: 0 }}
            >
              {compact ? <ChevronRightRounded /> : <ChevronLeftRounded />}
            </IconButton>
          </Tooltip>
        )}
        {isMobile && (
          <IconButton onClick={onMobileClose} size="small" sx={{ color: MUTED }} aria-label="Close navigation">
            <CloseRounded />
          </IconButton>
        )}
      </Box>

      {!compact && (
        <Typography sx={{ fontFamily: FONT, fontSize: "11px", fontWeight: 700, color: INK, textTransform: "uppercase", letterSpacing: "0.8px", mb: 1.5, px: 1.5 }}>
          Navigation
        </Typography>
      )}

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
                  minHeight: 44,
                  borderRadius: "10px",
                  py: 1.2,
                  px: compact ? 1.3 : 1.8,
                  justifyContent: compact ? "center" : "flex-start",
                  backgroundColor: active ? "rgba(22,24,29,0.12)" : "transparent",
                  color: active ? INK : INK,
                  transition: "all 0.15s ease",
                  "&:hover": { backgroundColor: active ? "rgba(22,24,29,0.16)" : "rgba(0,0,0,0.04)" },
                }}
              >
                <ListItemIcon sx={{ minWidth: compact ? 0 : 34, justifyContent: "center", color: active ? INK : MUTED }}>
                  {item.icon}
                </ListItemIcon>
                {!compact && (
                  <ListItemText
                    primary={
                      <Typography sx={{ fontFamily: FONT, fontSize: "13px", fontWeight: active ? 700 : 500, color: INK }}>
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
        </List>
      </Box>

      <Box sx={{ pt: 2 }}>
        <Divider sx={{ mb: 2, borderColor: BORDER }} />
        {!compact && (
          <Box sx={{ p: 1.5, borderRadius: "12px", backgroundColor: "#FFFFFF", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontFamily: FONT, fontSize: "11px", color: MUTED, fontWeight: 500 }}>Current Role</Typography>
              <Typography sx={{ fontFamily: FONT, fontSize: "13px", fontWeight: 700, color: INK }}>{currentRoleLabel}</Typography>
            </Box>
            <Chip label="Active" size="small" sx={{ fontFamily: FONT, fontSize: "10px", fontWeight: 700, height: 20, backgroundColor: "rgba(16,185,129,0.12)", color: "#059669" }} />
          </Box>
        )}
        <Tooltip title={compact ? "Logout" : ""} placement="right">
          <span>
            <Button
              fullWidth
              startIcon={<LogoutRounded sx={{ fontSize: 18 }} />}
              onClick={onLogout}
              disabled={loggingOut}
              sx={{
                height: 42,
                minWidth: 0,
                px: compact ? 0 : 2,
                borderRadius: "10px",
                border: `1px solid ${BORDER}`,
                backgroundColor: "#FFFFFF",
                color: INK,
                textTransform: "none",
                fontFamily: FONT,
                fontSize: "13px",
                fontWeight: 600,
                justifyContent: compact ? "center" : "flex-start",
                "& .MuiButton-startIcon": { mx: compact ? 0 : undefined },
                "&:hover": { backgroundColor: "rgba(22,24,29,0.05)", borderColor: INK, color: INK },
              }}
            >
              {!compact && (loggingOut ? "Signing out…" : "Logout")}
            </Button>
          </span>
        </Tooltip>
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
        sx={{ "& .MuiDrawer-paper": { boxSizing: "border-box", width: SIDEBAR_WIDTH } }}
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
