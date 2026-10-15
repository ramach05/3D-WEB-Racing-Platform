import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RACE_TIME_MAX_MS, RACE_TIME_MIN_MS } from '@racing/shared';
import { useGetLeaderboardQuery } from '@/entities/leaderboard';
import { useCreateRaceResultMutation } from '@/entities/race-result';
import { getTrackConfig, useGetTracksQuery } from '@/entities/track';
import { useAuthUser } from '@/features/auth';
import { useRaceAudio, useRaceDrivingSfx } from '@/features/race-audio';
import {
  bindRaceInput,
  finishRace,
  finishRaceForTest,
  readGuestBest,
  resetRaceSession,
  setVehiclePose,
  togglePause,
  useRaceHudSelector,
} from '@/features/race-session';
import { Button, PageShell, SegaLoader, StatusText } from '@/shared/ui';
import { RaceHud, RaceMinimap, RacePerfHud } from '@/widgets/hud';
import {
  cycleCameraMode,
  preloadVehicleModel,
  RaceCanvas,
  RaceRainOverlay,
  resetCameraMode,
  resetCameraShake,
  resetSkidMarks,
  useCameraMode,
} from '@/widgets/race-canvas';
import { RaceControls, RaceTouchControls } from '@/widgets/race-controls';
import { RaceCountdownOverlay } from '@/widgets/race-countdown';
import { RaceFinishMomentOverlay } from '@/widgets/race-finish-moment';
import { RaceFinishOverlay, type TFinishSubmitState } from '@/widgets/race-finish-overlay';
import { LeaderboardTable } from '@/widgets/leaderboard-table';
import { RacePauseMenu } from '@/widgets/race-pause-menu';

/** Время в допустимом диапазоне для POST /race-results (целое мс) */
const isSubmittableRaceTime = (timeMs: number): boolean => {
  const ms = Math.round(timeMs);
  return Number.isInteger(ms) && ms >= RACE_TIME_MIN_MS && ms <= RACE_TIME_MAX_MS;
};

type TRaceTestApi = {
  /** Тестовый хук для мгновенного финиша (e2e) */
  __finishRaceForTest?: () => void;
};

type TFinishMeta = {
  /** Время заезда в мс */
  timeMs: number;
  /** Новый личный рекорд */
  isNewBest: boolean;
  /** Статус отправки результата на сервер */
  submitState: TFinishSubmitState;
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
  // Только статус и время финиша: шаг обратного отсчета и круги не должны перерисовывать страницу с 3D-сценой.
  const hudStatus = useRaceHudSelector((snapshot) => snapshot.status);
  const hudFinishMs = useRaceHudSelector((snapshot) =>
    snapshot.status === 'finished' ? snapshot.timeMs : 0,
  );
  const cameraMode = useCameraMode();
  const user = useAuthUser();
  const [createResult] = useCreateRaceResultMutation();
  const [resetNonce, setResetNonce] = useState(0);
  const [restartToast, setRestartToast] = useState(false);
  const [finishMeta, setFinishMeta] = useState<TFinishMeta | null>(null);
  const [showFinishOverlay, setShowFinishOverlay] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [canvasArmed, setCanvasArmed] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const sessionKey =
    trackSlug && trackId && config ? `${trackSlug}:${config.checkpoints.length}` : '';
  const [prevSessionKey, setPrevSessionKey] = useState(sessionKey);
  const submittedRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);

  // Прогревает GLB до монтирования Canvas.
  useEffect(() => {
    preloadVehicleModel();
  }, []);

  // Взводит mount 3D-сцены на следующий кадр после отрисовки лоадера: монтирование тяжелое и блокирует main thread.
  useEffect(() => {
    if (canvasArmed || !config) {
      return;
    }
    let timerId = 0;
    const rafId = requestAnimationFrame(() => {
      timerId = window.setTimeout(() => setCanvasArmed(true), 0);
    });
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [canvasArmed, config]);

  // Скрывает лоадер после первого представленного кадра сцены.
  const handleFirstFrame = useCallback(() => {
    setSceneReady(true);
  }, []);

  if (sessionKey !== prevSessionKey) {
    setPrevSessionKey(sessionKey);
    if (sessionKey) {
      setFinishMeta(null);
      setShowFinishOverlay(false);
      setResetNonce((value) => value + 1);
      setCanvasArmed(false);
      setSceneReady(false);
    }
  }

  if (hudStatus !== 'finished' && showFinishOverlay) {
    setShowFinishOverlay(false);
  }

  const { data: leaderboard } = useGetLeaderboardQuery(trackSlug ?? '', {
    skip: !trackSlug,
  });
  const trackBestMs = leaderboard?.[0]?.timeMs ?? null;

  useRaceAudio({
    theme: hudStatus === 'finished' ? 'finish' : (config?.audioTheme ?? null),
    paused: hudStatus === 'paused',
    enabled: Boolean(config),
    muted: musicMuted,
  });

  useRaceDrivingSfx({
    enabled: Boolean(config) && hudStatus === 'racing',
    paused: hudStatus === 'paused',
    muted: false,
  });

  /** Рестарт заезда: сброс сессии, canvas и toast */
  const restart = useCallback(() => {
    if (!trackId || !config) {
      return;
    }
    submittedRef.current = false;
    setFinishMeta(null);
    setShowFinishOverlay(false);
    setResetNonce((value) => value + 1);
    resetCameraShake();
    resetRaceSession(trackId, config.checkpoints.length);
    // Поза = спавн сразу, чтобы миникарта не держала позицию прошлого заезда.
    setVehiclePose(config.spawnPosition[0], config.spawnPosition[2], config.spawnRotationY);
    setRestartToast(true);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setRestartToast(false);
      toastTimerRef.current = null;
    }, 2000);
  }, [config, trackId]);

  /** Переключение фоновой музыки (эффекты всегда слышны) */
  const toggleMute = useCallback(() => {
    setMusicMuted((value) => !value);
  }, []);

  /** Выход в меню трасс: сброс сессии, чтобы музыка/статус не протекали */
  const exitToTracks = useCallback(() => {
    if (trackId && config) {
      resetRaceSession(trackId, config.checkpoints.length);
    }
    void navigate('/tracks');
  }, [config, navigate, trackId]);

  /** Финиш: фиксирует время и отправляет результат (если авторизован) */
  const onFinished = useCallback(() => {
    if (!trackId || !trackSlug || submittedRef.current) {
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

    if (!isSubmittableRaceTime(timeMs)) {
      setFinishMeta({ timeMs, isNewBest, submitState: 'error' });
      return;
    }

    setFinishMeta({ timeMs, isNewBest, submitState: 'loading' });
    void createResult({ trackId, trackSlug, timeMs })
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
  }, [createResult, trackId, trackSlug, user]);

  // Сбрасывает сессию и следы при смене трассы/конфига и при уходе со страницы.
  useEffect(() => {
    if (!trackId || !config) {
      return;
    }
    submittedRef.current = false;
    resetRaceSession(trackId, config.checkpoints.length);
    // Поза = спавн сразу: иначе до первого физического кадра миникарта
    // проецирует нулевую позу и маркер «прыгает» на старт при прогрузке трассы.
    setVehiclePose(config.spawnPosition[0], config.spawnPosition[2], config.spawnRotationY);
    resetSkidMarks();
    resetCameraMode();
    resetCameraShake();
    return () => {
      resetRaceSession(trackId, config.checkpoints.length);
      resetSkidMarks();
      resetCameraMode();
      resetCameraShake();
    };
  }, [config, trackId]);

  // Биндит клавиатуру: рестарт и пауза.
  useEffect(() => {
    return bindRaceInput({
      onRestart: restart,
      onTogglePause: togglePause,
      onCycleCamera: cycleCameraMode,
      isRaceActive: () => true,
    });
  }, [restart]);

  // Чистит таймер toast при размонтировании.
  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // После финиша показывает overlay с задержкой.
  useEffect(() => {
    if (hudStatus !== 'finished') {
      return;
    }
    // Всегда даём сыграть finish-moment (FINISH! → время); CSS сам глушит motion
    const id = window.setTimeout(() => setShowFinishOverlay(true), FINISH_OVERLAY_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [hudStatus]);

  // E2E: вешает __finishRaceForTest на window.
  useEffect(() => {
    if (!trackId || !trackSlug) {
      return;
    }
    const raceWindow = window as Window & TRaceTestApi;
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

      if (!isSubmittableRaceTime(timeMs)) {
        setFinishMeta({ timeMs, isNewBest, submitState: 'error' });
        return;
      }

      setFinishMeta({ timeMs, isNewBest, submitState: 'loading' });
      void createResult({ trackId, trackSlug, timeMs })
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
  }, [createResult, trackId, trackSlug, user]);

  if (isLoading) {
    return (
      <div className="sega-scanlines relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-black">
        <SegaLoader className="min-h-0 py-16" />
      </div>
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

  return (
    <div className="sega-scanlines relative min-h-0 w-full flex-1 overflow-hidden bg-black">
      <div className="absolute inset-0">
        {canvasArmed ? (
          <RaceCanvas
            config={config}
            resetNonce={resetNonce}
            onFinished={onFinished}
            onFirstFrame={handleFirstFrame}
          />
        ) : null}
        {canvasArmed && config.weather === 'rain' && hudStatus !== 'finished' ? (
          <RaceRainOverlay />
        ) : null}
      </div>
      {sceneReady ? (
        <>
          <div className="absolute top-2 right-2 z-10 flex w-[9.5rem] max-w-[calc(100%-1rem)] flex-col items-end gap-2 md:top-4 md:right-4 lg:w-[13rem]">
            <div className="pointer-events-none w-full">
              <RaceHud trackName={track.name} bestMs={trackBestMs} />
            </div>
            <div className="pointer-events-none w-[5.5rem] self-end sm:w-[6.5rem] lg:w-full">
              <RaceMinimap config={config} />
            </div>
          </div>
          <div className="pointer-events-none absolute top-2 left-2 z-10 flex max-w-[calc(100%-1rem)] flex-col items-start gap-2 md:top-4 md:left-4">
            <RacePerfHud />
            <Button
              variant="ghost"
              size="sm"
              className="pointer-events-auto sega-panel !hidden h-8 w-8 items-center justify-center !px-0 !bg-black/70 md:!inline-flex"
              aria-label={musicMuted ? t('race.musicOff') : t('race.musicOn')}
              aria-pressed={!musicMuted}
              onClick={toggleMute}
            >
              <span
                aria-hidden
                className={
                  musicMuted
                    ? 'text-lg leading-none text-white/50 line-through'
                    : 'text-lg leading-none text-[var(--sega-yellow)]'
                }
              >
                {'\u266A'}
              </span>
            </Button>
          </div>
          <RaceControls cameraMode={cameraMode} />
          <RaceTouchControls
            onRestart={restart}
            onTogglePause={togglePause}
            onCycleCamera={cycleCameraMode}
            muted={musicMuted}
            onToggleMute={toggleMute}
            footer={!user && hudStatus !== 'finished' ? t('race.guestHint') : undefined}
          />
          <RaceCountdownOverlay />
          <RaceFinishMomentOverlay
            active={hudStatus === 'finished' && !showFinishOverlay}
            timeMs={finishMeta?.timeMs ?? hudFinishMs}
            isNewBest={finishMeta?.isNewBest ?? false}
          />
          <RacePauseMenu
            open={hudStatus === 'paused'}
            onResume={togglePause}
            onRestart={restart}
            onExit={exitToTracks}
          />
          <RaceFinishOverlay
            open={hudStatus === 'finished' && showFinishOverlay}
            trackName={track.name}
            timeMs={finishMeta?.timeMs ?? hudFinishMs}
            bestMs={trackBestMs}
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
            onExit={exitToTracks}
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
          {!user && hudStatus !== 'finished' ? (
            <p className="pointer-events-none absolute bottom-4 right-4 z-10 hidden max-w-[min(100%,20rem)] text-right text-xs text-white/70 md:block">
              {t('race.guestHint')}
            </p>
          ) : null}
        </>
      ) : (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black">
          <SegaLoader label={t('race.loadingScene')} />
        </div>
      )}
    </div>
  );
};
