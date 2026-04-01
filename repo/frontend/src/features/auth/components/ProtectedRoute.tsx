import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';

export function ProtectedRoute() {
  const auth = useAuth();

  if (auth.isLoading) return <div>Loading...</div>;
  if (!auth.user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
