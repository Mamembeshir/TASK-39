import { Outlet } from 'react-router-dom';
import { AppProviders } from '@/app/providers';

export function App() {
  return (
    <AppProviders>
      <Outlet />
    </AppProviders>
  );
}
