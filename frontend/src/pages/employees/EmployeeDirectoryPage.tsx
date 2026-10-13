import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import EmployeeDirectory from "../../components/employees/EmployeeDirectory";
import api from "../../services/api";
import { getRoleId } from "../../utils/auth";
import type { EmployeeDetail } from "../../types/employee";

export default function EmployeeDirectoryPage() {
  const roleId = getRoleId();
  const canManage = roleId === 1 || roleId === 2 || roleId === 4;

  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  const [employees, setEmployees] = useState<EmployeeDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<EmployeeDetail[]>("/employees");
      setEmployees(res.data);
    } catch {
      // Error handled gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query) {
      setSearchParams({ q: query }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  return (
    <AppLayout
      pageTitle="Employee Directory"
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
    >
      <EmployeeDirectory
        employees={employees}
        loading={loading}
        onRefresh={fetchEmployees}
        canManage={canManage}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
      />
    </AppLayout>
  );
}
