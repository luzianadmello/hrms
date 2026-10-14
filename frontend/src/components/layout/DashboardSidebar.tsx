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
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  CloseRounded,
  DashboardRounded,
  GroupsRounded,
  LogoutRounded,
  PersonOutlineRounded,
} from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getRoleLabel,
  isEmployeeView,
  isTeamViewOnly,
} from "../../utils/permissions";

const FONT = "'Montserrat', sans-serif";
const INK = "#16181D";
const TEAL = "#16181D";
const MUTED = "#6B6F76";
const BORDER = "#DAD7CF";

export const SIDEBAR_WIDTH = 260;

interface DashboardSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  userRoleName?: string;
  onLogout: () => void;
  loggingOut?: boolean;
}

export default function DashboardSidebar({
  mobileOpen,
  onMobileClose,
  userRoleName,
  onLogout,
  loggingOut = false,
}: DashboardSidebarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const isEmployee = isEmployeeView();
  const isManager = isTeamViewOnly();

  const currentRoleLabel = userRoleName || getRoleLabel() || "Employee";

  const handleNavClick = (path: string) => {
    navigate(path);
    if (isMobile) {
      onMobileClose();
    }
  };

  // Define navigation items strictly based on role permissions
  // Employee Management appears as ONE top-level item for HR/Admin
  // Employees never see Employee Management
  // All Coming Soon modules are removed
  const navItems = isEmployee
    ? [
        {
          path: "/dashboard",
          label: "My Dashboard",
          icon: <DashboardRounded sx={{ fontSize: 20 }} />,
          active: location.pathname === "/dashboard",
        },
        {
          path: "/profile",
          label: "My Profile",
          icon: <PersonOutlineRounded sx={{ fontSize: 20 }} />,
          active: location.pathname === "/profile",
        },
      ]
    : isManager
    ? [
        {
          path: "/dashboard",
          label: "Dashboard",
          icon: <DashboardRounded sx={{ fontSize: 20 }} />,
          active: location.pathname === "/dashboard",
        },
        {
          path: "/employees/directory",
          label: "Employee Directory",
          icon: <GroupsRounded sx={{ fontSize: 20 }} />,
          active: location.pathname.startsWith("/employees"),
        },
      ]
    : [
        {
          path: "/dashboard",
          label: "Dashboard",
          icon: <DashboardRounded sx={{ fontSize: 20 }} />,
          active: location.pathname === "/dashboard",
        },
        {
          path: "/employees",
          label: "Employee Management",
          icon: <GroupsRounded sx={{ fontSize: 20 }} />,
          active: location.pathname.startsWith("/employees"),
        },
      ];

  const sidebarContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "#FAF9F6",
        borderRight: `1px solid ${BORDER}`,
        p: 2.5,
      }}
    >
      {/* Brand Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 3.5,
          px: 1,
        }}
      >
        <Box
          onClick={() => handleNavClick("/dashboard")}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            cursor: "pointer",
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              backgroundColor: TEAL,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "16px",
              boxShadow: "0 4px 12px rgba(22,24,29,0.3)",
            }}
          >
            H
          </Box>
          <Box>
            <Typography
              sx={{
                fontFamily: FONT,
                fontSize: "16px",
                fontWeight: 700,
                color: INK,
                letterSpacing: "-0.4px",
                lineHeight: 1.2,
              }}
            >
              HRMS
            </Typography>
            <Typography
              sx={{
                fontFamily: FONT,
                fontSize: "11px",
                color: MUTED,
                fontWeight: 500,
              }}
            >
              Workspace Portal
            </Typography>
          </Box>
        </Box>

        {isMobile && (
          <IconButton onClick={onMobileClose} size="small" sx={{ color: MUTED }}>
            <CloseRounded />
          </IconButton>
        )}
      </Box>

      {/* Navigation List */}
      <Box sx={{ flex: 1, overflowY: "auto", pr: 0.5 }}>
        <Typography
          sx={{
            fontFamily: FONT,
            fontSize: "11px",
            fontWeight: 700,
            color: TEAL,
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            mb: 1.5,
            px: 1.5,
          }}
        >
          Navigation
        </Typography>

        <List disablePadding>
          {navItems.map((item) => (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.8 }}>
              <ListItemButton
                onClick={() => handleNavClick(item.path)}
                sx={{
                  borderRadius: "10px",
                  py: 1.2,
                  px: 1.8,
                  backgroundColor: item.active
                    ? "rgba(22,24,29,0.12)"
                    : "transparent",
                  color: item.active ? TEAL : INK,
                  transition: "all 0.15s ease",
                  "&:hover": {
                    backgroundColor: item.active
                      ? "rgba(22,24,29,0.16)"
                      : "rgba(0,0,0,0.04)",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 34,
                    color: item.active ? TEAL : MUTED,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      sx={{
                        fontFamily: FONT,
                        fontSize: "13px",
                        fontWeight: item.active ? 700 : 500,
                        color: item.active ? TEAL : INK,
                      }}
                    >
                      {item.label}
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Sidebar Footer with Role Badge & Logout */}
      <Box sx={{ pt: 2 }}>
        <Divider sx={{ mb: 2, borderColor: BORDER }} />

        <Box
          sx={{
            p: 1.5,
            borderRadius: "12px",
            backgroundColor: "#FFFFFF",
            border: `1px solid ${BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1.5,
          }}
        >
          <Box>
            <Typography
              sx={{
                fontFamily: FONT,
                fontSize: "11px",
                color: MUTED,
                fontWeight: 500,
              }}
            >
              Current Role
            </Typography>
            <Typography
              sx={{
                fontFamily: FONT,
                fontSize: "13px",
                fontWeight: 700,
                color: INK,
              }}
            >
              {currentRoleLabel}
            </Typography>
          </Box>
          <Chip
            label="Active"
            size="small"
            sx={{
              fontFamily: FONT,
              fontSize: "10px",
              fontWeight: 700,
              height: 20,
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              color: "#059669",
            }}
          />
        </Box>

        <Button
          fullWidth
          startIcon={<LogoutRounded sx={{ fontSize: 18 }} />}
          onClick={onLogout}
          disabled={loggingOut}
          sx={{
            height: 42,
            borderRadius: "10px",
            border: `1px solid ${BORDER}`,
            backgroundColor: "#FFFFFF",
            color: INK,
            textTransform: "none",
            fontFamily: FONT,
            fontSize: "13px",
            fontWeight: 600,
            "&:hover": {
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              borderColor: "rgba(239, 68, 68, 0.3)",
              color: "#DC2626",
            },
          }}
        >
          {loggingOut ? "Signing out…" : "Logout"}
        </Button>
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
        sx={{
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: SIDEBAR_WIDTH,
          },
        }}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  return (
    <Box
      component="nav"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 100,
      }}
    >
      {sidebarContent}
    </Box>
  );
}
