import { LoginForm } from '@/features/auth';
import { PageShell } from '@/shared/ui';

/** Страница входа */
export const LoginPage = () => {
  return (
    <PageShell>
      <LoginForm />
    </PageShell>
  );
};
