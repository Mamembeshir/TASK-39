import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/features/auth/hooks/useAuth';
import { BookingProvider } from '@/features/booking/store';
import { Toaster } from '@/shared/components/ui/sonner';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function ThemeProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BookingProvider>
            <Toaster />
            {children}
          </BookingProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
