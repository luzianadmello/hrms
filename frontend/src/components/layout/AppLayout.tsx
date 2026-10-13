import { useState, type ReactNode } from "react";
import { Box } from "@mui/material";
import { useNavigate } from "react-router-dom";

import AppNavbar from "./AppNavbar";
import DashboardSidebar, { SIDEBAR_WIDTH } from "./DashboardSidebar";
import { logout } from "../../services/session";

const FONT = "'Montserrat', sans-serif";

interface AppLayoutProps {
  children: ReactNode;
  pageTitle: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showSearch?: boolean;
}

export default function AppLayout({
  children,
  pageTitle,
  searchQuery = "",
  onSearchChange,
  showSearch,
}: AppLayoutProps) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#F5F4F0",
        fontFamily: FONT,
        position: "relative",
        overflowX: "hidden",

        "&::before": {
          content: '""',
          position: "fixed",
          width: 480,
          height: 480,
          borderRadius: "50%",
          top: -180,
          right: -120,
          filter: "blur(110px)",
          background: "rgba(22,24,29,0.10)",
          pointerEvents: "none",
          zIndex: 0,
        },

        "&::after": {
          content: '""',
          position: "fixed",
          width: 400,
          height: 400,
          borderRadius: "50%",
          bottom: -180,
          left: -120,
          filter: "blur(110px)",
          background: "rgba(214,190,150,0.25)",
          pointerEvents: "none",
          zIndex: 0,
        },
      }}
    >
      {/* Sidebar */}
      <DashboardSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />

      {/* Main Wrapper */}
      <Box
        sx={{
          flexGrow: 1,
          ml: { xs: 0, md: `${SIDEBAR_WIDTH}px` },
          width: { xs: "100%", md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Shared Top Navbar */}
        <AppNavbar
          pageTitle={pageTitle}
          onMobileMenuToggle={() => setMobileOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          showSearch={showSearch}
        />

        {/* Content Body */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2.5, sm: 3.5, md: 4.5 },
          }}
        >
          <Box sx={{ maxWidth: 1250, mx: "auto" }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
