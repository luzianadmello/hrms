import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import EmployeeDirectory from "../../components/employees/EmployeeDirectory";
import api from "../../services/api";
import { canAny } from "../../utils/permissions";
import type { EmployeeDetail } from "../../types/employee";

export default function EmployeeDirectoryPage() {
  const canManage = canAny("employee.view_all", "employee.view_team");

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
      pageTitle="My Team"
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
