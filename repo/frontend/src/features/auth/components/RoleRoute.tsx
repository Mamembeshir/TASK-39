import { Navigate, Outlet } from 'react-router-dom';
import { hasRole, useAuth } from '@/features/auth/hooks/useAuth';

export function RoleRoute({ roles }: { roles: ('moderator' | 'administrator')[] }) {
  const auth = useAuth();
  if (auth.isLoading) return <div>Loading...</div>;
  if (!auth.user) return <Navigate to="/login" replace />;
  if (!hasRole(auth.roles, roles)) return <Navigate to="/app" replace />;
  return <Outlet />;
}
