import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { Alert } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Separator } from '@/shared/components/ui/separator';
import { toast } from 'sonner';
import { showApiError } from '@/shared/lib/showApiError';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('new_customer');
  const [password, setPassword] = useState('devpass123456');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 12) return setError('Password must be at least 12 characters');
    try {
      setSubmitting(true);
      await register({ username, password });
      navigate('/catalog', { replace: true });
    } catch (e) {
      const message = showApiError(e);
      toast.error(message);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell eyebrow="Create your account" title="Start with HomeCareOps" subtitle="A polished home for bookings, requests, and customer support.">
      <Card>
        <CardHeader>
          <CardTitle>Register</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <p className="text-xs text-slate-500">Use at least 12 characters for security.</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting} className="h-11 w-full">
              {submitting ? 'Creating account...' : 'Create account'}
            </Button>
            <Separator />
            <p className="text-center text-sm text-slate-600">
              Already have an account? <a className="font-medium text-slate-950 underline underline-offset-4" href="/login">Sign in</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
