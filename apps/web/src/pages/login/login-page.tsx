import { useTranslation } from 'react-i18next';
import { LoginForm } from '@/features/auth';
import { PageMeta, PageShell } from '@/shared/ui';

/** Login page */
export const LoginPage = () => {
  const { t } = useTranslation();

  return (
    <PageShell>
      <PageMeta title={t('auth.loginTitle')} />
      <LoginForm />
    </PageShell>
  );
};
