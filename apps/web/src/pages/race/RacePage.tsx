import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCreateRaceResultMutation } from '@/entities/race-result';
import { getTrackConfig, useGetTracksQuery } from '@/entities/track';
import { useAuthUser } from '@/features/auth';
import { useRaceAudio } from '@/features/race-audio';
import {
  bindRaceInput,
  finishRace,
  finishRaceForTest,
  resetRaceSession,
  startRacing,
  togglePause,
  useRaceHud,
} from '@/features/race-session';
import { PageShell, StatusText } from '@/shared/ui';
import { RaceHud } from '@/widgets/hud';
import { RaceCanvas } from '@/widgets/race-canvas';
import { RaceControls } from '@/widgets/race-controls';
import { RacePauseMenu } from '@/widgets/race-pause-menu';

type RaceTestApi = {
  __finishRaceForTest?: () => void;
};

/** Страница заезда: 3D-сцена, HUD, пауза, отправка результата */
export const RacePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trackId } = useParams<{ trackId: string }>();
  const { data: tracks, isLoading, isError } = useGetTracksQuery();
  const track = tracks?.find((item) => item.id === trackId) ?? null;
  const config = track ? getTrackConfig(track.slug) : null;
  const hud = useRaceHud();
  const user = useAuthUser();
  const [createResult] = useCreateRaceResultMutation();
  const [resetNonce, setResetNonce] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [restartToast, setRestartToast] = useState(false);
  const submittedRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);

  useRaceAudio({
    theme: config?.audioTheme ?? null,
    paused: hud.status !== 'racing',
    enabled: Boolean(config),
  });

  const restart = useCallback(() => {
    if (!trackId || !config) {
      return;
    }
    submittedRef.current = false;
    setSubmitError(null);
    setResetNonce((value) => value + 1);
    resetRaceSession(trackId, config.checkpoints.length);
    setRestartToast(true);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setRestartToast(false);
      toastTimerRef.current = null;
    }, 2000);
  }, [config, trackId]);

  const onFinished = useCallback(() => {
    if (!trackId || submittedRef.current) {
      return;
    }
    submittedRef.current = true;
    const timeMs = finishRace(trackId);
    if (!user) {
      return;
    }
    void createResult({ trackId, timeMs })
      .unwrap()
      .catch(() => setSubmitError(t('race.submitError')));
  }, [createResult, t, trackId, user]);

  useEffect(() => {
    if (!trackId || !config) {
      return;
    }
    submittedRef.current = false;
    resetRaceSession(trackId, config.checkpoints.length);
  }, [config, trackId]);

  useEffect(() => {
    if (!trackId || !config) {
      return;
    }
    const timer = window.setTimeout(() => {
      startRacing();
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [config, resetNonce, trackId]);

  useEffect(() => {
    return bindRaceInput({
      onRestart: restart,
      onTogglePause: togglePause,
      isRaceActive: () => true,
    });
  }, [restart]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!trackId) {
      return;
    }
    const raceWindow = window as Window & RaceTestApi;
    raceWindow.__finishRaceForTest = () => {
      if (submittedRef.current) {
        return;
      }
      submittedRef.current = true;
      const timeMs = finishRaceForTest(trackId, 33_000);
      if (user) {
        void createResult({ trackId, timeMs });
      }
    };
    return () => {
      delete raceWindow.__finishRaceForTest;
    };
  }, [createResult, trackId, user]);

  if (isLoading) {
    return (
      <PageShell>
        <StatusText>{t('tracks.loading')}</StatusText>
      </PageShell>
    );
  }

  if (isError || !track || !config || !trackId) {
    return (
      <PageShell>
        <StatusText>{t('tracks.error')}</StatusText>
        <Link to="/tracks" className="mt-3 inline-block text-sm text-[var(--accent)] underline">
          {t('race.toTracks')}
        </Link>
      </PageShell>
    );
  }

  return (
    <div className="sega-scanlines relative h-[calc(100vh-4.5rem)] w-full overflow-hidden bg-black">
      <RaceCanvas
        config={config}
        paused={hud.status !== 'racing'}
        resetNonce={resetNonce}
        onFinished={onFinished}
      />
      <RaceHud />
      <RaceControls />
      <RacePauseMenu
        open={hud.status === 'paused'}
        onResume={togglePause}
        onRestart={restart}
        onExit={() => navigate('/tracks')}
      />
      {restartToast ? (
        <p
          role="status"
          aria-live="polite"
          className="sega-race-toast pointer-events-none absolute left-1/2 top-24 z-20 -translate-x-1/2 sega-panel bg-black/80 px-4 py-2 text-sm text-[var(--sega-yellow)]"
        >
          {t('race.restarted')}
        </p>
      ) : null}
      {!user ? (
        <p className="pointer-events-none absolute bottom-4 right-4 max-w-xs text-right text-xs text-white/70">
          {t('race.guestHint')}
        </p>
      ) : null}
      {submitError ? (
        <p role="alert" className="absolute bottom-4 right-4 text-sm text-red-200">
          {submitError}
        </p>
      ) : null}
    </div>
  );
};
