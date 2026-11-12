import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { homePath } from "../lib/roles";
import type { Role } from "../types";

export default function RoleRoute({ allow }: { allow: Role[] }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allow.includes(user.roles)) {
    return <Navigate to={homePath(user.roles)} replace />;
  }

  return <Outlet />;
}
