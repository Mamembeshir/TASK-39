import type { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { hasRole, useAuth } from '@/features/auth/hooks/useAuth';

type GateRole = 'moderator' | 'administrator' | 'service_manager';

export function RoleGate({ roles, fallback = '/app', children }: PropsWithChildren<{ roles: GateRole[]; fallback?: string }>) {
  const auth = useAuth();
  if (auth.isLoading) return <div>Loading...</div>;
  if (!auth.user) return <Navigate to="/login" replace />;
  if (!roles.some((role) => auth.roles.includes(role))) return <Navigate to={fallback} replace />;
  return children ?? null;
}
