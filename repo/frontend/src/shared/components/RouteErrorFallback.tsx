import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

export function RouteErrorFallback() {
  const error = useRouteError();
  const navigate = useNavigate();

  const title = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'Something went wrong';
  const message = isRouteErrorResponse(error)
    ? (error.data as { message?: string } | undefined)?.message || 'We could not load this page.'
    : 'We could not load this page right now.';

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">{message}</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/catalog')}>Back home</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
