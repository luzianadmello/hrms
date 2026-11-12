import { useState, type ReactNode } from "react";
import { Box } from "@mui/material";

import AppNavbar from "./AppNavbar";
import DashboardSidebar, { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from "./DashboardSidebar";
import { useThemeMode } from "../../contexts/ThemeModeContext";

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
  const { mode } = useThemeMode();
  const isDark = mode === "dark";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <Box
      sx={{
        // The navigation is fixed-position, so it does not participate in
        // layout flow. Use a block root and offset the content wrapper below.
        display: "block",
        width: "100%",
        minHeight: "100vh",
        backgroundColor: isDark ? "#34373D" : "#F5F4F0",
        fontFamily: FONT,
        position: "relative",
        overflowX: "hidden",

      }}
    >
      {/* Sidebar */}
      <DashboardSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
      />

      {/* Main Wrapper */}
      <Box
        sx={{
          // The sidebar is fixed and removed from normal flex flow. Reserve
          // its width explicitly so page content never renders underneath it.
          flexGrow: 0,
          flexShrink: 0,
          boxSizing: "border-box",
          ml: { xs: 0, md: `${sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH}px` },
          width: { xs: "100%", md: `calc(100% - ${sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH}px)` },
          minWidth: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 1,
          transition: "margin-left 0.18s ease, width 0.18s ease",
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
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            p: { xs: 2.25, sm: 3, md: 3.5 },
          }}
        >
          <Box sx={{ width: "100%", maxWidth: 1250, minWidth: 0, mx: "auto" }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
