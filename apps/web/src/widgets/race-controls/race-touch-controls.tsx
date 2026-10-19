import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { clearTouchAxes, setTouchAxis, type TTouchAxis } from '@/features/race-session';

type TRaceTouchControlsProps = {
  /** Restart the race */
  onRestart: () => void;
  /** Pause / resume */
  onTogglePause: () => void;
  /** Cycle the camera mode */
  onCycleCamera: () => void;
  /** Text below the buttons (e.g. guest hint) */
  footer?: ReactNode;
  /** Sound is off (for the button state) */
  muted?: boolean;
  /** Toggle sound; without it the button is not rendered */
  onToggleMute?: () => void;
};

type TAxisButtonProps = {
  /** Touch input axis */
  axis: TTouchAxis;
  /** Visible glyph on the button */
  symbol: string;
  /** aria-label */
  label: string;
  /** Extra class (e.g. accent) */
  className?: string;
};

/** Axis button: hold via pointer capture */
const AxisButton = ({ axis, symbol, label, className }: TAxisButtonProps) => {
  const [pressed, setPressed] = useState(false);
  const pressedRef = useRef(false);

  // Clears the axis if the button was still considered pressed
  const release = (): void => {
    if (!pressedRef.current) {
      return;
    }
    pressedRef.current = false;
    setPressed(false);
    setTouchAxis(axis, false);
  };

  // pointerdown: capture the pointer and activate the axis
  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    pressedRef.current = true;
    setPressed(true);
    setTouchAxis(axis, true);
  };

  return (
    <button
      type="button"
      className={`sega-touch-btn ${className ?? ''}`}
      aria-label={label}
      aria-pressed={pressed}
      onPointerDown={onPointerDown}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <span aria-hidden>{symbol}</span>
    </button>
  );
};

/** Mobile SEGA pad: steering on the left, throttle/brake on the right, pause and restart on top */
export const RaceTouchControls = ({
  onRestart,
  onTogglePause,
  onCycleCamera,
  footer,
  muted = false,
  onToggleMute,
}: TRaceTouchControlsProps) => {
  const { t } = useTranslation();

  useEffect(() => {
    return () => {
      clearTouchAxes();
    };
  }, []);

  return (
    <div className="sega-touch-pad" role="group" aria-label={t('race.controlsTitle')}>
      <div className="sega-touch-pad__actions">
        <button
          type="button"
          className="sega-touch-btn sega-touch-btn--sm"
          aria-label={t('race.touch.pause')}
          onClick={onTogglePause}
        >
          <span aria-hidden>II</span>
        </button>
        <button
          type="button"
          className="sega-touch-btn sega-touch-btn--sm"
          aria-label={t('race.touch.restart')}
          onClick={onRestart}
        >
          <span aria-hidden>R</span>
        </button>
        <button
          type="button"
          className="sega-touch-btn sega-touch-btn--sm"
          aria-label={t('race.touch.camera')}
          onClick={onCycleCamera}
        >
          <span aria-hidden>CAM</span>
        </button>
        {onToggleMute ? (
          <button
            type="button"
            className="sega-touch-btn sega-touch-btn--sm"
            aria-label={muted ? t('race.musicOff') : t('race.musicOn')}
            aria-pressed={!muted}
            onClick={onToggleMute}
          >
            <span aria-hidden className={muted ? 'text-white/40 line-through' : undefined}>
              {'\u266A'}
            </span>
          </button>
        ) : null}
      </div>
      <div className="sega-touch-pad__row">
        <div className="sega-touch-pad__cluster">
          <AxisButton
            axis="steerLeft"
            symbol="◀"
            label={t('race.touch.steerLeft')}
            className="sega-touch-btn--steer"
          />
          <AxisButton
            axis="steerRight"
            symbol="▶"
            label={t('race.touch.steerRight')}
            className="sega-touch-btn--steer"
          />
        </div>
        <div className="sega-touch-pad__pedals">
          <AxisButton
            axis="handbrake"
            symbol="HB"
            label={t('race.touch.handbrake')}
            className="sega-touch-btn--handbrake"
          />
          <div className="sega-touch-pad__cluster sega-touch-pad__cluster--stack">
            <AxisButton
              axis="throttle"
              symbol="▲"
              label={t('race.touch.throttle')}
              className="sega-touch-btn--throttle"
            />
            <AxisButton
              axis="brake"
              symbol="▼"
              label={t('race.touch.brake')}
              className="sega-touch-btn--brake"
            />
          </div>
        </div>
      </div>
      {footer ? <p className="sega-touch-pad__footer">{footer}</p> : null}
    </div>
  );
};
