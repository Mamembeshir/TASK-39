import { Suspense, lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { App } from '@/app/App';
import { AppLayout } from '@/shared/components/AppLayout';
import { RouteErrorFallback } from '@/shared/components/RouteErrorFallback';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { ModerationRoute } from '@/features/moderation/components/ModerationRoute';
import { RoleGate } from '@/shared/components/RoleGate';

const HealthPage = lazy(async () => {
  const module = await import('@/shared/pages/HealthPage');
  return { default: module.HealthPage };
});
const RootRedirect = lazy(async () => ({ default: (await import('@/app/RootRedirect')).RootRedirect }));

const LoginPage = lazy(async () => ({ default: (await import('@/features/auth/pages/LoginPage')).LoginPage }));
const RegisterPage = lazy(async () => ({ default: (await import('@/features/auth/pages/RegisterPage')).RegisterPage }));
const CatalogPage = lazy(async () => ({ default: (await import('@/features/catalog/pages/CatalogPage')).CatalogPage }));
const ServiceDetailPage = lazy(async () => ({ default: (await import('@/features/catalog/pages/ServiceDetailPage')).ServiceDetailPage }));
const ComparePage = lazy(async () => ({ default: (await import('@/features/booking/pages/ComparePage')).ComparePage }));
const FavoritesPage = lazy(async () => ({ default: (await import('@/features/booking/pages/FavoritesPage')).FavoritesPage }));
const CheckoutPage = lazy(async () => ({ default: (await import('@/features/orders/pages/CheckoutPage')).CheckoutPage }));
const OrderDetailPage = lazy(async () => ({ default: (await import('@/features/orders/pages/OrderDetailPage')).OrderDetailPage }));
const ReviewSubmitPage = lazy(async () => ({ default: (await import('@/features/reviews/pages/ReviewSubmitPage')).ReviewSubmitPage }));
const ModerationQueuePage = lazy(async () => ({ default: (await import('@/features/moderation/pages/ModerationQueuePage')).ModerationQueuePage }));
const QuestionModerationPage = lazy(async () => ({ default: (await import('@/features/moderation/pages/QuestionModerationPage')).QuestionModerationPage }));
const TicketCreatePage = lazy(async () => ({ default: (await import('@/features/tickets/pages/TicketCreatePage')).TicketCreatePage }));
const TicketsListPage = lazy(async () => ({ default: (await import('@/features/tickets/pages/TicketsListPage')).TicketsListPage }));
const TicketDetailPage = lazy(async () => ({ default: (await import('@/features/tickets/pages/TicketDetailPage')).TicketDetailPage }));
const ContentListPage = lazy(async () => ({ default: (await import('@/features/content/pages/ContentListPage')).ContentListPage }));
const ContentArticlePage = lazy(async () => ({ default: (await import('@/features/content/pages/ContentArticlePage')).ContentArticlePage }));
const ContentStudioPage = lazy(async () => ({ default: (await import('@/features/content/pages/ContentStudioPage')).ContentStudioPage }));
const InboxPage = lazy(async () => ({ default: (await import('@/features/inbox/pages/InboxPage')).InboxPage }));
const SearchPage = lazy(async () => ({ default: (await import('@/features/search/pages/SearchPage')).SearchPage }));
const AdminHomePage = lazy(async () => ({ default: (await import('@/features/admin/pages/AdminHomePage')).AdminHomePage }));
const OpsHomePage = lazy(async () => ({ default: (await import('@/features/ops/pages/OpsHomePage')).OpsHomePage }));
const OpsSlotsPage = lazy(async () => ({ default: (await import('@/features/ops/pages/OpsSlotsPage')).OpsSlotsPage }));
const ModHomePage = lazy(async () => ({ default: (await import('@/features/mod-console/pages/ModHomePage')).ModHomePage }));

function HealthRoute() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8"><div className="grid gap-4"><div className="h-8 w-48 rounded-xl bg-muted" /><div className="h-56 w-full rounded-2xl bg-muted" /></div></div>}>
      <HealthPage />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <RouteErrorFallback />,
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
      {
        element: <AppLayout />,
        errorElement: <RouteErrorFallback />,
        children: [
          {
            index: true,
            element: <RootRedirect />,
          },
          {
            path: 'catalog',
            element: <CatalogPage />,
          },
          {
            path: 'services/:id',
            element: <ServiceDetailPage />,
          },
          {
            path: 'content',
            element: <ContentListPage />,
          },
          {
            path: 'content/:id',
            element: <ContentArticlePage />,
          },
          {
            path: 'ops/content',
            element: <RoleGate roles={['service_manager', 'administrator']}><ContentStudioPage /></RoleGate>,
          },
          {
            path: 'search',
            element: <SearchPage />,
          },
          {
            element: <ProtectedRoute />,
            children: [
              {
                path: 'app',
                element: <Navigate to="/catalog" replace />,
              },
              {
                path: 'favorites',
                element: <FavoritesPage />,
              },
              {
                path: 'compare',
                element: <ComparePage />,
              },
              {
                path: 'checkout',
                element: <CheckoutPage />,
              },
              {
                path: 'orders/:id',
                element: <OrderDetailPage />,
              },
              {
                path: 'orders/:id/review',
                element: <ReviewSubmitPage />,
              },
              {
                path: 'tickets',
                element: <TicketsListPage />,
              },
              {
                path: 'tickets/new',
                element: <TicketCreatePage />,
              },
              {
                path: 'tickets/:id',
                element: <TicketDetailPage />,
              },
              {
                path: 'inbox',
                element: <InboxPage />,
              },
              {
                path: 'mod/reviews',
                element: <ModerationRoute><ModerationQueuePage /></ModerationRoute>,
              },
              {
                path: 'mod/questions',
                element: <ModerationRoute><QuestionModerationPage /></ModerationRoute>,
              },
            ],
          },
          {
            path: 'admin',
            element: <RoleGate roles={['administrator']}><AdminHomePage /></RoleGate>,
          },
          {
            path: 'ops',
            element: <RoleGate roles={['service_manager', 'administrator']}><OpsHomePage /></RoleGate>,
          },
          {
            path: 'ops/slots',
            element: <RoleGate roles={['service_manager', 'administrator']}><OpsSlotsPage /></RoleGate>,
          },
          {
            path: 'mod',
            element: <RoleGate roles={['moderator', 'administrator']}><ModHomePage /></RoleGate>,
          },
        ],
      },
    ],
  },
]);
