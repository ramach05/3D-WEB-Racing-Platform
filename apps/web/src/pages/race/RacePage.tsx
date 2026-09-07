import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetLeaderboardQuery } from '@/entities/leaderboard';
import { useCreateRaceResultMutation } from '@/entities/race-result';
import { getTrackConfig, useGetTracksQuery } from '@/entities/track';
import { useAuthUser } from '@/features/auth';
import { useRaceAudio } from '@/features/race-audio';
import {
  bindRaceInput,
  finishRace,
  finishRaceForTest,
  readGuestBest,
  resetRaceSession,
  togglePause,
  useRaceHud,
} from '@/features/race-session';
import { Button, PageShell, StatusText } from '@/shared/ui';
import { RaceHud, RacePerfHud } from '@/widgets/hud';
import { RaceCanvas } from '@/widgets/race-canvas';
import { RaceControls } from '@/widgets/race-controls';
import { RaceCountdownOverlay } from '@/widgets/race-countdown';
import { RaceFinishMomentOverlay } from '@/widgets/race-finish-moment';
import { RaceFinishOverlay, type FinishSubmitState } from '@/widgets/race-finish-overlay';
import { LeaderboardTable } from '@/widgets/leaderboard-table';
import { RacePauseMenu } from '@/widgets/race-pause-menu';

type RaceTestApi = {
  __finishRaceForTest?: () => void;
};

type FinishMeta = {
  timeMs: number;
  isNewBest: boolean;
  submitState: FinishSubmitState;
};

/** FINISH! + время до модалки результатов */
const FINISH_OVERLAY_DELAY_MS = 4000;

/** Страница заезда: 3D-сцена, HUD, пауза, отправка результата */
export const RacePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trackSlug } = useParams<{ trackSlug: string }>();
  const { data: tracks, isLoading, isError } = useGetTracksQuery();
  const track = tracks?.find((item) => item.slug === trackSlug) ?? null;
  const trackId = track?.id;
  const config = track ? getTrackConfig(track.slug) : null;
  const hud = useRaceHud();
  const user = useAuthUser();
  const [createResult] = useCreateRaceResultMutation();
  const [resetNonce, setResetNonce] = useState(0);
  const [restartToast, setRestartToast] = useState(false);
  const [finishMeta, setFinishMeta] = useState<FinishMeta | null>(null);
  const [showFinishOverlay, setShowFinishOverlay] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const sessionKey =
    trackSlug && trackId && config ? `${trackSlug}:${config.checkpoints.length}` : '';
  const [prevSessionKey, setPrevSessionKey] = useState(sessionKey);
  const submittedRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);

  if (sessionKey !== prevSessionKey) {
    setPrevSessionKey(sessionKey);
    if (sessionKey) {
      setFinishMeta(null);
      setShowFinishOverlay(false);
      setResetNonce((value) => value + 1);
    }
  }

  const { data: leaderboard } = useGetLeaderboardQuery(trackId ?? '', {
    skip: !trackId || hud.status !== 'finished' || !user,
  });

  useRaceAudio({
    theme: config?.audioTheme ?? null,
    paused: hud.status !== 'racing',
    enabled: Boolean(config),
    muted: musicMuted,
  });

  const restart = useCallback(() => {
    if (!trackId || !config) {
      return;
    }
    submittedRef.current = false;
    setFinishMeta(null);
    setShowFinishOverlay(false);
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
    const prevBest = readGuestBest(trackId);
    const timeMs = finishRace(trackId);
    const isNewBest = prevBest === null || timeMs < prevBest;

    if (!user) {
      setFinishMeta({ timeMs, isNewBest, submitState: 'idle' });
      return;
    }

    setFinishMeta({ timeMs, isNewBest, submitState: 'loading' });
    void createResult({ trackId, timeMs })
      .unwrap()
      .then(() => {
        setFinishMeta((prev) =>
          prev ? { ...prev, submitState: 'done' } : { timeMs, isNewBest, submitState: 'done' },
        );
      })
      .catch(() => {
        setFinishMeta((prev) =>
          prev ? { ...prev, submitState: 'error' } : { timeMs, isNewBest, submitState: 'error' },
        );
      });
  }, [createResult, trackId, user]);

  useEffect(() => {
    if (!trackId || !config) {
      return;
    }
    submittedRef.current = false;
    resetRaceSession(trackId, config.checkpoints.length);
  }, [config, trackId]);

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
    if (hud.status !== 'finished') {
      setShowFinishOverlay(false);
      return;
    }
    // Всегда даём сыграть finish-moment (FINISH! → время); CSS сам глушит motion
    const id = window.setTimeout(() => setShowFinishOverlay(true), FINISH_OVERLAY_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [hud.status]);

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
      const prevBest = readGuestBest(trackId);
      const timeMs = finishRaceForTest(trackId, 33_000);
      const isNewBest = prevBest === null || timeMs < prevBest;

      if (!user) {
        setFinishMeta({ timeMs, isNewBest, submitState: 'idle' });
        return;
      }

      setFinishMeta({ timeMs, isNewBest, submitState: 'loading' });
      void createResult({ trackId, timeMs })
        .unwrap()
        .then(() => {
          setFinishMeta((prev) =>
            prev ? { ...prev, submitState: 'done' } : { timeMs, isNewBest, submitState: 'done' },
          );
        })
        .catch(() => {
          setFinishMeta((prev) =>
            prev ? { ...prev, submitState: 'error' } : { timeMs, isNewBest, submitState: 'error' },
          );
        });
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

  if (isError || !track || !config || !trackSlug || !trackId) {
    return (
      <PageShell>
        <StatusText>{t('tracks.error')}</StatusText>
        <Link to="/tracks" className="mt-3 inline-block text-sm text-[var(--accent)] underline">
          {t('race.toTracks')}
        </Link>
      </PageShell>
    );
  }

  const physicsPaused =
    hud.status === 'paused' || hud.status === 'finished' || hud.status === 'countdown';

  return (
    <div className="sega-scanlines relative min-h-0 w-full flex-1 overflow-hidden bg-black">
      <div className="absolute inset-0">
        <RaceCanvas
          config={config}
          physicsPaused={physicsPaused}
          crowdPaused={hud.status === 'paused'}
          resetNonce={resetNonce}
          onFinished={onFinished}
        />
      </div>
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
        <div className="pointer-events-none">
          <RaceHud />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="sega-panel bg-black/70 text-[var(--sega-yellow)]"
          aria-pressed={!musicMuted}
          onClick={() => setMusicMuted((value) => !value)}
        >
          {musicMuted ? t('race.musicOff') : t('race.musicOn')}
        </Button>
      </div>
      <RacePerfHud />
      <RaceControls />
      <RaceCountdownOverlay />
      <RaceFinishMomentOverlay
        active={hud.status === 'finished' && !showFinishOverlay}
        timeMs={finishMeta?.timeMs ?? hud.timeMs}
        isNewBest={finishMeta?.isNewBest ?? false}
      />
      <RacePauseMenu
        open={hud.status === 'paused'}
        onResume={togglePause}
        onRestart={restart}
        onExit={() => navigate('/tracks')}
      />
      <RaceFinishOverlay
        open={hud.status === 'finished' && showFinishOverlay}
        trackName={track.name}
        timeMs={finishMeta?.timeMs ?? hud.timeMs}
        bestMs={hud.bestMs}
        isNewBest={finishMeta?.isNewBest ?? false}
        isGuest={!user}
        submitState={finishMeta?.submitState ?? 'idle'}
        userRank={
          user?.id && leaderboard
            ? (leaderboard.find((entry) => entry.userId === user.id)?.rank ?? null)
            : null
        }
        leaderboardSlot={
          leaderboard && leaderboard.length > 0 ? (
            <LeaderboardTable entries={leaderboard} highlightUserId={user?.id} maxRows={5} />
          ) : null
        }
        onRestart={restart}
        onExit={() => navigate('/tracks')}
        onOpenLeaderboard={() => navigate('/leaderboard')}
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
      {!user && hud.status !== 'finished' ? (
        <p className="pointer-events-none absolute bottom-4 right-4 max-w-xs text-right text-xs text-white/70">
          {t('race.guestHint')}
        </p>
      ) : null}
    </div>
  );
};
