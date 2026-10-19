import { RegisterForm } from '@/features/auth';
import { PageShell } from '@/shared/ui';

/** Registration page */
export const RegisterPage = () => {
  return (
    <PageShell>
      <RegisterForm />
    </PageShell>
  );
};
