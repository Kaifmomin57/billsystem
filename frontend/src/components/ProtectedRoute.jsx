import { Navigate, Outlet } from "react-router-dom";
import { authStorage } from "../lib/auth";

export default function ProtectedRoute() {
  if (!authStorage.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
