import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/home';
import { GaragePage } from '@/pages/garage';
import { LeaderboardPage } from '@/pages/leaderboard';
import { LoginPage } from '@/pages/login';
import { ProfilePage } from '@/pages/profile';
import { RacePage } from '@/pages/race';
import { RegisterPage } from '@/pages/register';
import { TracksPage } from '@/pages/tracks';
import { SegaRouteProgress } from '@/shared/ui';
import { AppHeader } from '@/widgets/header';

type TAppLayoutProps = {
  /** Содержимое main */
  children: ReactNode;
};

/** Корневой layout: шапка + main */
const AppLayout = ({ children }: TAppLayoutProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)] text-[var(--fg)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--surface)] focus:px-3 focus:py-2"
      >
        {t('a11y.skip')}
      </a>
      <SegaRouteProgress />
      <AppHeader />
      <main id="main" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>
    </div>
  );
};

/** Маршруты SPA */
export const AppRouter = () => {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tracks" element={<TracksPage />} />
          <Route path="/garage" element={<GaragePage />} />
          <Route path="/race/:trackSlug" element={<RacePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
};
