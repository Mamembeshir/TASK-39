import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import type { ApiError } from '@/api/types/api-error';
import { PageHeader } from '@/shared/components/PageHeader';
import { PageShell } from '@/shared/components/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

type HealthResponse = {
  status: string;
};

export function HealthPage() {
  const healthQuery = useQuery<HealthResponse, ApiError>({
    queryKey: ['health-check'],
    queryFn: () => client.request<HealthResponse>({ method: 'GET', path: '/api/health' }),
  });

  return (
    <PageShell width="narrow">
      <div className="grid gap-6">
        <PageHeader title="Health check" description="Verify API availability and inspect error payloads when requests fail." />

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            {healthQuery.isLoading && <p>Checking API health...</p>}
            {healthQuery.isSuccess && <p>API status: {healthQuery.data.status}</p>}
            {healthQuery.isError && (
              <>
                <p>Health check failed.</p>
                <p>
                  {healthQuery.error.code}: {healthQuery.error.message}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
