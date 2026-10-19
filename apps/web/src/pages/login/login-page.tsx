import { LoginForm } from '@/features/auth';
import { PageShell } from '@/shared/ui';

/** Login page */
export const LoginPage = () => {
  return (
    <PageShell>
      <LoginForm />
    </PageShell>
  );
};
