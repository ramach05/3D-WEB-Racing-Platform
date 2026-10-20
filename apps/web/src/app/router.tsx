import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/home';
import { LeaderboardPage } from '@/pages/leaderboard';
import { LoginPage } from '@/pages/login';
import { ProfilePage } from '@/pages/profile';
import { RegisterPage } from '@/pages/register';
import { SegaLoader, SegaRouteProgress, SegaSkeleton } from '@/shared/ui';
import { AppHeader } from '@/widgets/header';

// 3D pages are lazy: R3F/Rapier chunks and GLB fetches stay out of light pages
const importGaragePage = () => import('@/pages/garage').then((m) => ({ default: m.GaragePage }));
const importRacePage = () => import('@/pages/race').then((m) => ({ default: m.RacePage }));
const GaragePage = lazy(importGaragePage);
const RacePage = lazy(importRacePage);
const TracksPage = lazy(() => import('@/pages/tracks').then((m) => ({ default: m.TracksPage })));

type TAppLayoutProps = {
  /** Main content */
  children: ReactNode;
};

/** Root layout: header + main */
const AppLayout = ({ children }: TAppLayoutProps) => {
  const { t } = useTranslation();

  // Warms the heavy 3D chunks while idle: entering a race then skips the suspense fallback
  useEffect(() => {
    const prefetch = (): void => {
      void importRacePage();
      void importGaragePage();
    };
    // DOM lib types it as always-present, but older Safari lacks it
    const requestIdle: typeof window.requestIdleCallback | undefined = window.requestIdleCallback;
    if (requestIdle) {
      const idleId = requestIdle.call(window, prefetch, { timeout: 5000 });
      return (): void => window.cancelIdleCallback?.(idleId);
    }
    const timerId = window.setTimeout(prefetch, 2000);
    return (): void => window.clearTimeout(timerId);
  }, []);

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

/** Chunk-loading fallback for lazy 3D pages */
const PageSkeleton = () => (
  <div className="sega-panel mx-auto my-10 w-full max-w-3xl p-6" aria-hidden="true">
    <div className="grid gap-3">
      <SegaSkeleton className="sega-skeleton--inset h-8 w-1/2" />
      <SegaSkeleton className="sega-skeleton--inset h-4 w-full" />
      <SegaSkeleton className="sega-skeleton--inset h-4 w-4/5" />
      <SegaSkeleton className="sega-skeleton--inset aspect-[16/9] w-full" />
    </div>
  </div>
);

/** Chunk-loading screen for the race: same look as the in-page scene loader */
const RaceChunkFallback = () => {
  const { t } = useTranslation();
  return (
    <div className="sega-scanlines relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-black">
      <SegaLoader className="min-h-0 py-16" label={t('race.loadingScene')} />
    </div>
  );
};

/** SPA routes */
export const AppRouter = () => {
  return (
    <BrowserRouter>
      <AppLayout>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/tracks" element={<TracksPage />} />
            <Route path="/garage" element={<GaragePage />} />
            <Route
              path="/race/:trackSlug"
              element={
                <Suspense fallback={<RaceChunkFallback />}>
                  <RacePage />
                </Suspense>
              }
            />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppLayout>
    </BrowserRouter>
  );
};
