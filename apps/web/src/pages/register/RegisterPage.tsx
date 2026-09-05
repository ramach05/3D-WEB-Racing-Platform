import { RegisterForm } from '@/features/auth';
import { PageShell } from '@/shared/ui';

/** Страница регистрации */
export const RegisterPage = () => {
  return (
    <PageShell>
      <RegisterForm />
    </PageShell>
  );
};
