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
  /** Рестарт заезда */
  onRestart: () => void;
  /** Пауза / снятие паузы */
  onTogglePause: () => void;
  /** Текст под кнопками (например guest hint) */
  footer?: ReactNode;
};

type TAxisButtonProps = {
  /** Ось touch-ввода */
  axis: TTouchAxis;
  /** Видимый символ на кнопке */
  symbol: string;
  /** aria-label */
  label: string;
  /** Доп. класс (например accent) */
  className?: string;
};

/** Кнопка оси: hold через pointer capture */
const AxisButton = ({ axis, symbol, label, className }: TAxisButtonProps) => {
  const [pressed, setPressed] = useState(false);
  const pressedRef = useRef(false);

  /** Сбрасывает ось, если кнопка ещё считалась нажатой */
  const release = (): void => {
    if (!pressedRef.current) {
      return;
    }
    pressedRef.current = false;
    setPressed(false);
    setTouchAxis(axis, false);
  };

  /** pointerdown: захват и активация оси */
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

/** Мобильный SEGA-пад: руль слева, газ/тормоз справа, пауза и рестарт сверху */
export const RaceTouchControls = ({
  onRestart,
  onTogglePause,
  footer,
}: TRaceTouchControlsProps) => {
  const { t } = useTranslation();

  useEffect(() => {
    return () => {
      clearTouchAxes();
    };
  }, []);

  return (
    <div
      className="sega-touch-pad"
      role="group"
      aria-label={t('race.controlsTitle')}
    >
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
      {footer ? <p className="sega-touch-pad__footer">{footer}</p> : null}
    </div>
  );
};
