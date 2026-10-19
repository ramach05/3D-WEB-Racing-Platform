import { useTranslation } from 'react-i18next';
import { RegisterForm } from '@/features/auth';
import { PageMeta, PageShell } from '@/shared/ui';

/** Registration page */
export const RegisterPage = () => {
  const { t } = useTranslation();

  return (
    <PageShell>
      <PageMeta title={t('auth.registerTitle')} />
      <RegisterForm />
    </PageShell>
  );
};
