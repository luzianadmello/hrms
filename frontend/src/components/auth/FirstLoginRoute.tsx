import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";

import api from "../../services/api";

interface FirstLoginRouteProps {
  children: ReactNode;
}

function FirstLoginRoute({ children }: FirstLoginRouteProps) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const checkPasswordStatus = async () => {
      try {
        const response = await api.get("/auth/me");
        setAllowed(response.data.must_change_password === true);
      } catch {
        setAllowed(false);
      } finally {
        setLoading(false);
      }
    };

    checkPasswordStatus();
  }, []);

  if (loading) {
    return null;
  }

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default FirstLoginRoute;