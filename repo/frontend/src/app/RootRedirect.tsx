import { Navigate } from 'react-router-dom';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAuth } from '@/features/auth/hooks/useAuth';

export function RootRedirect() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <div className="flex min-h-screen items-center justify-center p-6"><Skeleton className="h-12 w-48" /></div>;
  }

  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/catalog" replace />;
}
