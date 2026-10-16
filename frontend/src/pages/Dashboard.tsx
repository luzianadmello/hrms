import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";
import {
  AccessTimeOutlined,
  AddRounded,
  CorporateFareOutlined,
  EventAvailableOutlined,
  PeopleOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

import AppLayout from "../components/layout/AppLayout";
import api from "../services/api";
import { can, isEmployeeView, isTeamViewOnly, getRoleLabel } from "../utils/permissions";
import type { EmployeeDetail, EmployeeProfile, EmployeeStats } from "../types/employee";

const FONT = "'Montserrat', sans-serif";
const INK = "#16181D";
const TEAL = "#16181D";
const MUTED = "#6B6F76";
const BORDER = "#DAD7CF";

interface StatCardProps {
  icon: ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  onClick?: () => void;
}

function StatCard({ icon, title, value, subtitle, onClick }: StatCardProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        backgroundColor: "#FFFFFF",
        border: `1px solid ${BORDER}`,
        borderRadius: "16px",
        p: 2.5,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease",
        "&:hover": onClick
          ? {
              transform: "translateY(-2px)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
              borderColor: TEAL,
            }
          : undefined,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "10px",
            backgroundColor: "rgba(22,24,29,0.09)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box sx={{ color: TEAL, display: "flex" }}>{icon}</Box>
        </Box>
        {subtitle && (
          <Typography
            sx={{
              fontFamily: FONT,
              fontSize: "11px",
              fontWeight: 600,
              color: TEAL,
              backgroundColor: "rgba(22,24,29,0.08)",
              px: 1,
              py: "2px",
              borderRadius: "4px",
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>

      <Typography
        sx={{ fontFamily: FONT, fontSize: "12px", color: MUTED, mb: 0.5 }}
      >
        {title}
      </Typography>

      <Typography
        sx={{
          fontFamily: FONT,
          fontSize: "26px",
          fontWeight: 700,
          color: INK,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const isEmployee = isEmployeeView();
  const isManager = isTeamViewOnly();
  const roleLabel = getRoleLabel();

  const [loading, setLoading] = useState(true);

  // HR Dashboard State
  const [employees, setEmployees] = useState<EmployeeDetail[]>([]);
  const [stats, setStats] = useState<EmployeeStats | null>(null);

  // Employee Dashboard State
  const [myProfile, setMyProfile] = useState<EmployeeProfile | null>(null);

  const fetchHRData = useCallback(async () => {
    try {
      setLoading(true);
      const [empRes, statsRes] = await Promise.allSettled([
        api.get<EmployeeDetail[]>("/employees"),
        api.get<EmployeeStats>("/employees/stats"),
      ]);

      if (empRes.status === "fulfilled") {
        setEmployees(empRes.value.data);
      }

      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value.data);
      } else if (empRes.status === "fulfilled") {
        const list = empRes.value.data;
        setStats({
          total_employees: list.length,
          active_employees: list.filter((e) => e.status === "ACTIVE").length,
          inactive_employees: list.filter((e) => e.status === "INACTIVE").length,
          profile_incomplete: list.filter((e) => e.status === "ACTIVE" && !e.profile_completed).length,
          total_departments: new Set(list.map((e) => e.department_id).filter(Boolean)).size,
        });
      }
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployeeData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<EmployeeProfile>("/employees/me");
      setMyProfile(res.data);
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isEmployee || isManager) {
      fetchEmployeeData();
    }
    if (!isEmployee && !isManager) {
      fetchHRData();
    }
  }, [isEmployee, isManager, fetchEmployeeData, fetchHRData]);

  if (loading) {
    return (
      <AppLayout pageTitle={isEmployee ? "My Dashboard" : isManager ? "My Dashboard" : "HR Dashboard"}>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
          <CircularProgress sx={{ color: TEAL }} />
        </Box>
      </AppLayout>
    );
  }

  // ========================================================
  // RENDER: INDIVIDUAL EMPLOYEE DASHBOARD
  // ========================================================
  if (isEmployee) {
    const employeeName = myProfile?.first_name ? `${myProfile.first_name} ${myProfile.last_name || ""}`.trim() : "Employee";
    const initials = myProfile?.first_name
      ? `${myProfile.first_name[0]}${myProfile.last_name ? myProfile.last_name[0] : ""}`.toUpperCase()
      : "EM";


    return (
      <AppLayout pageTitle="My Dashboard" showSearch={false}>
        {/* Welcome Banner */}
        <Box
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: "20px",
            backgroundColor: "#FFFFFF",
            border: `1px solid ${BORDER}`,
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
            mb: 4,
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            gap: 2.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
            <Avatar
              sx={{
                width: 68,
                height: 68,
                bgcolor: TEAL,
                color: "#FFFFFF",
                fontFamily: FONT,
                fontSize: "22px",
                fontWeight: 700,
                boxShadow: "0 6px 16px rgba(22,24,29,0.25)",
              }}
            >
              {initials}
            </Avatar>

            <Box>
              <Typography
                sx={{
                  fontFamily: FONT,
                  fontSize: "12px",
                  fontWeight: 700,
                  color: TEAL,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  mb: 0.5,
                }}
              >
                Employee Portal
              </Typography>

              <Typography
                component="h2"
                sx={{
                  fontFamily: FONT,
                  fontSize: { xs: "22px", md: "28px" },
                  fontWeight: 700,
                  color: INK,
                  letterSpacing: "-0.6px",
                }}
              >
                Welcome back, {employeeName}!
              </Typography>

              <Typography sx={{ fontFamily: FONT, fontSize: "13px", color: MUTED, mt: 0.4 }}>
                {myProfile?.designation_name || "Employee"} • {myProfile?.department_name || "Department"} • Code:{" "}
                <strong>{myProfile?.employee_code}</strong>
              </Typography>
            </Box>
          </Box>


        </Box>

      </AppLayout>
    );
  }

  // ========================================================
  // RENDER: MANAGER DASHBOARD — employee-style welcome + team-only info
  // ========================================================
  if (isManager) {
    const managerName = myProfile?.first_name
      ? `${myProfile.first_name} ${myProfile.last_name || ""}`.trim()
      : "Manager";
    const initials = `${myProfile?.first_name?.[0] || "M"}${myProfile?.last_name?.[0] || ""}`.toUpperCase();
    return (
      <AppLayout pageTitle="My Dashboard" showSearch={false}>
        <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: "20px", backgroundColor: "#FFFFFF", border: `1px solid ${BORDER}`, boxShadow: "0 4px 20px rgba(0,0,0,0.03)", mb: 3, display: "flex", alignItems: "center", gap: 2.5 }}>
          <Avatar sx={{ width: 68, height: 68, bgcolor: INK, color: "#FFFFFF", fontFamily: FONT, fontSize: "22px", fontWeight: 700 }}>{initials}</Avatar>
          <Box>
            <Typography sx={{ fontFamily: FONT, fontSize: "12px", fontWeight: 700, color: TEAL, textTransform: "uppercase", letterSpacing: "0.8px", mb: 0.5 }}>Manager Portal</Typography>
            <Typography component="h2" sx={{ fontFamily: FONT, fontSize: { xs: "22px", md: "28px" }, fontWeight: 700, color: INK, letterSpacing: "-0.6px" }}>Welcome back, {managerName}!</Typography>
            <Typography sx={{ fontFamily: FONT, fontSize: "13px", color: MUTED, mt: 0.4 }}>{myProfile?.designation_name || "Manager"} • {myProfile?.department_name || "Department"}</Typography>
          </Box>
        </Box>
        <Box sx={{ backgroundColor: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: "16px", p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Box>
              <Typography sx={{ fontFamily: FONT, fontWeight: 700, fontSize: "18px", color: INK }}>Your Team</Typography>
              <Typography sx={{ fontFamily: FONT, fontSize: "13px", color: MUTED, mt: 0.5 }}>View the employees who report to you.</Typography>
            </Box>
            <Button variant="contained" onClick={() => navigate("/employees")} sx={{ backgroundColor: INK, color: "#FFF", textTransform: "none", fontFamily: FONT, borderRadius: "10px", px: 2.5, "&:hover": { backgroundColor: "#2B2F38" } }}>View My Team</Button>
          </Box>
        </Box>
      </AppLayout>
    );
  }

  // ========================================================
  // RENDER: HR / ADMIN DASHBOARD
  // ========================================================
  return (
    <AppLayout pageTitle={roleLabel === "Admin" ? "Admin Dashboard" : "HR Dashboard"}>
      {/* Top Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          mb: 4,
        }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: FONT,
              fontSize: "12px",
              fontWeight: 700,
              color: TEAL,
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              mb: 0.5,
            }}
          >
            Management Overview
          </Typography>

          <Typography
            component="h2"
            sx={{
              fontFamily: FONT,
              fontSize: { xs: "24px", md: "30px" },
              fontWeight: 700,
              color: INK,
              letterSpacing: "-0.6px",
            }}
          >
            HR Dashboard
          </Typography>

          <Typography sx={{ fontFamily: FONT, fontSize: "13px", color: MUTED, mt: 0.4 }}>
            Here is the current overview of staff and workforce operations across the organization.
          </Typography>
        </Box>

        {/* Quick Actions */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Button
            startIcon={<VisibilityOutlined />}
            onClick={() => navigate("/employees")}
            sx={{
              height: 42,
              px: 2.5,
              borderRadius: "10px",
              border: `1px solid ${BORDER}`,
              backgroundColor: "#FFFFFF",
              color: INK,
              textTransform: "none",
              fontFamily: FONT,
              fontSize: "13px",
              fontWeight: 600,
              "&:hover": { backgroundColor: "#FAF9F6", borderColor: TEAL },
            }}
          >
            {can("employee.view_all") ? "Employees" : "My Team"}
          </Button>

          {can("user.create") && (
            <Button
              startIcon={<AddRounded />}
              onClick={() => navigate("/employees/create")}
              sx={{
                height: 42,
                px: 2.5,
                borderRadius: "10px",
                backgroundColor: INK,
                color: "#FFFFFF",
                textTransform: "none",
                fontFamily: FONT,
                fontSize: "13px",
                fontWeight: 600,
                "&:hover": { backgroundColor: "#2B2F38" },
              }}
            >
              Create Employee
            </Button>
          )}
        </Box>
      </Box>

      {/* KPI Cards */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ fontFamily: FONT, fontSize: "15px", fontWeight: 700, color: INK, mb: 2 }}>
          Employee Management Analytics
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              md: "repeat(5, 1fr)",
            },
            gap: 2.5,
          }}
        >
          <StatCard
            icon={<PeopleOutlined />}
            title="Total Employees"
            value={stats ? stats.total_employees : employees.length}
            subtitle="All Staff"
            onClick={() => navigate("/employees")}
          />

          <StatCard
            icon={<AccessTimeOutlined />}
            title="Active Employees"
            value={stats ? stats.active_employees : employees.filter((e) => e.status === "ACTIVE").length}
            subtitle="Live"
            onClick={() => navigate("/employees?status=ACTIVE")}
          />

          <StatCard
            icon={<PeopleOutlined />}
            title="Inactive"
            value={stats ? stats.inactive_employees : 0}
            subtitle="Cannot log in"
            onClick={() => navigate("/employees?status=INACTIVE")}
          />

          <StatCard
            icon={<EventAvailableOutlined />}
            title="Profile Incomplete"
            value={stats ? stats.profile_incomplete ?? 0 : 0}
            subtitle="Active, not finished"
            onClick={() => navigate("/employees?status=ACTIVE")}
          />

          <StatCard
            icon={<CorporateFareOutlined />}
            title="Total Departments"
            value={stats ? stats.total_departments : 0}
            subtitle="Active Units"
          />
        </Box>
      </Box>

      {/* Overview Cards Grid */}
        
    </AppLayout>
  );
}