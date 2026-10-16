import { useState, type KeyboardEvent, useEffect } from "react";
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  LogoutRounded,
  MenuRounded,
  PersonOutlineRounded,
  SearchRounded,
} from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";

import api from "../../services/api";
import { logout } from "../../services/session";
import { canAny, getRoleLabel } from "../../utils/permissions";

const FONT = "'Montserrat', sans-serif";
const INK = "#16181D";
const TEAL = "#16181D";
const MUTED = "#6B6F76";
const BORDER = "#DAD7CF";

interface AppNavbarProps {
  pageTitle: string;
  onMobileMenuToggle?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showSearch?: boolean;
}

export default function AppNavbar({
  pageTitle,
  onMobileMenuToggle,
  searchQuery = "",
  onSearchChange,
  showSearch,
}: AppNavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const hideDashboardTitle = location.pathname === "/dashboard";
  const canSearchEmployees = canAny("employee.view_all", "employee.view_team");

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [currentUser, setCurrentUser] = useState<{
    email: string;
    role_name?: string;
    has_employee_profile?: boolean;
    first_name?: string;
    last_name?: string;
  } | null>(null);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    const fetchMe = async () => {
      try {
        const { data: me } = await api.get("/auth/me");
        if (cancelled) return;

        const hasProfile = me.has_employee_profile === true;

        setCurrentUser({
          email: me.email,
          role_name: getRoleLabel() || "Employee",
          has_employee_profile: hasProfile,
        });

        // Accounts like the Admin have no employee record, so skip the call
        if (hasProfile) {
          try {
            const { data: profile } = await api.get("/employees/me");
            if (!cancelled) {
              setCurrentUser((prev) => ({
                ...prev!,
                first_name: profile.first_name || "",
                last_name: profile.last_name || "",
              }));
            }
          } catch {
            // Profile may be incomplete, email is sufficient
          }
        }
      } catch {
        // Handled gracefully
      }
    };
    fetchMe();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenProfileMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleNavigateProfile = () => {
    handleCloseMenu();
    navigate("/profile");
  };

  const handleLogout = async () => {
    handleCloseMenu();
    await logout();
    navigate("/login", { replace: true });
  };

  const handleSearchSubmit = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      if (onSearchChange) {
        onSearchChange(localSearch);
      } else if (canSearchEmployees) {
        navigate(`/employees?q=${encodeURIComponent(localSearch.trim())}`);
      }
    }
  };

  const handleSearchChangeInternal = (value: string) => {
    setLocalSearch(value);
    if (onSearchChange) {
      onSearchChange(value);
    }
  };

  // Get user initials
  const initials = currentUser?.first_name
    ? `${currentUser.first_name[0]}${currentUser.last_name ? currentUser.last_name[0] : ""}`.toUpperCase()
    : currentUser?.email
    ? currentUser.email.substring(0, 2).toUpperCase()
    : "U";

  const displayName = currentUser?.first_name
    ? `${currentUser.first_name} ${currentUser.last_name || ""}`.trim()
    : currentUser?.email || "User";

  return (
    <Box
      component="header"
      sx={{
        height: 70,
        backgroundColor: "#FFFFFF",
        borderBottom: `1px solid ${BORDER}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: { xs: 2, sm: 3, md: 4 },
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Left section: Mobile menu toggle + Brand & Page Title */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        {onMobileMenuToggle && (
          <IconButton
            onClick={onMobileMenuToggle}
            sx={{
              display: { xs: "flex", md: "none" },
              border: `1px solid ${BORDER}`,
              borderRadius: "10px",
              color: INK,
              p: 1,
            }}
          >
            <MenuRounded sx={{ fontSize: 20 }} />
          </IconButton>
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            onClick={() => navigate("/dashboard")}
            sx={{
              display: { xs: "none", sm: "flex" },
              alignItems: "center",
              gap: 1.2,
              cursor: "pointer",
              pr: 2,
              borderRight: `1px solid ${BORDER}`,
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                backgroundColor: TEAL,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: "14px",
              }}
            >
              H
            </Box>
            <Typography
              sx={{
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: "16px",
                color: INK,
                letterSpacing: "-0.5px",
              }}
            >
              HRMS
            </Typography>
          </Box>

          {/* Keep dashboard title in the page content to avoid duplication. */}
          {!hideDashboardTitle && <Typography
            component="h1"
            sx={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: { xs: "16px", sm: "18px", md: "20px" },
              color: INK,
              letterSpacing: "-0.4px",
            }}
          >
            {pageTitle}
          </Typography>}
        </Box>
      </Box>

      {/* Center/Right section: Search Field + User Profile Menu */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        {/* Permission-aware Search Field */}
        {(showSearch ?? true) && (
          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            {canSearchEmployees ? (
              <TextField
                placeholder="Search employees…"
                size="small"
                value={localSearch}
                onChange={(e) => handleSearchChangeInternal(e.target.value)}
                onKeyDown={handleSearchSubmit}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRounded sx={{ color: MUTED, fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  width: { sm: 200, md: 280 },
                  "& .MuiOutlinedInput-root": {
                    height: 40,
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
            ) : null}
          </Box>
        )}

        {/* User Profile / Avatar Icon & Dropdown */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Tooltip title="Account settings">
            <IconButton
              onClick={handleOpenProfileMenu}
              size="small"
              sx={{
                p: 0.5,
                border: `1px solid ${openMenu ? TEAL : BORDER}`,
                borderRadius: "50%",
                transition: "all 0.2s ease",
                "&:hover": { borderColor: TEAL },
              }}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: "rgba(22,24,29,0.12)",
                  color: TEAL,
                  fontFamily: FONT,
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                {initials}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={openMenu}
            onClose={handleCloseMenu}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            slotProps={{
              paper: {
                sx: {
                  width: 240,
                  mt: 1.5,
                  borderRadius: "14px",
                  border: `1px solid ${BORDER}`,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                  p: 1,
                },
              },
            }}
          >
            {/* Header info */}
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography
                sx={{
                  fontFamily: FONT,
                  fontWeight: 700,
                  fontSize: "14px",
                  color: INK,
                  lineHeight: 1.2,
                }}
              >
                {displayName}
              </Typography>
              <Typography
                sx={{
                  fontFamily: FONT,
                  fontSize: "12px",
                  color: MUTED,
                  mt: 0.4,
                  wordBreak: "break-all",
                }}
              >
                {currentUser?.email || ""}
              </Typography>
              <Box
                sx={{
                  mt: 1,
                  display: "inline-block",
                  px: 1,
                  py: "2px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(22,24,29,0.1)",
                  color: TEAL,
                  fontFamily: FONT,
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                {currentUser?.role_name || "Employee"}
              </Box>
            </Box>

            <Divider sx={{ my: 0.8, borderColor: "#EBE8E1" }} />

            {/* View Profile */}
            {currentUser?.has_employee_profile && (
              <MenuItem
                onClick={handleNavigateProfile}
                sx={{
                  borderRadius: "8px",
                  py: 1,
                  px: 1.5,
                  fontFamily: FONT,
                  fontSize: "13px",
                  fontWeight: 600,
                  color: INK,
                  gap: 1.5,
                  "&:hover": { backgroundColor: "#FAF9F6", color: TEAL },
                }}
              >
                <PersonOutlineRounded sx={{ fontSize: 18 }} />
                View Profile
              </MenuItem>
            )}

            {/* Logout */}
            <MenuItem
              onClick={handleLogout}
              sx={{
                borderRadius: "8px",
                py: 1,
                px: 1.5,
                fontFamily: FONT,
                fontSize: "13px",
                fontWeight: 600,
                color: "#DC2626",
                gap: 1.5,
                "&:hover": { backgroundColor: "rgba(239,68,68,0.06)" },
              }}
            >
              <LogoutRounded sx={{ fontSize: 18 }} />
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Box>
    </Box>
  );
}
