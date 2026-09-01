import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/home';
import { LeaderboardPage } from '@/pages/leaderboard';
import { LoginPage } from '@/pages/login';
import { ProfilePage } from '@/pages/profile';
import { RacePage } from '@/pages/race';
import { RegisterPage } from '@/pages/register';
import { TracksPage } from '@/pages/tracks';
import { AppHeader } from '@/widgets/header';

type AppLayoutProps = {
  children: ReactNode;
};

/** Корневой layout: шапка + main */
const AppLayout = ({ children }: AppLayoutProps) => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--surface)] focus:px-3 focus:py-2"
      >
        {t('a11y.skip')}
      </a>
      <AppHeader />
      <main id="main">{children}</main>
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
          <Route path="/race/:trackId" element={<RacePage />} />
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
