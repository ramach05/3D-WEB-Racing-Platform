import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '@/shared/lib';

type TSegaLoaderProps = {
  /** Label; defaults to common.loading */
  label?: ReactNode;
  /** Extra wrapper classes */
  className?: string;
};

/** Arcade loading indicator (LOADING + blink dots) */
export const SegaLoader = ({ label, className }: TSegaLoaderProps) => {
  const { t } = useTranslation();
  const text = label ?? t('common.loading');

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cx('sega-loader', className ?? '')}
    >
      <p className="sega-loader__label">
        {text}
        <span className="sega-loader__dots sega-blink" aria-hidden="true">
          ...
        </span>
      </p>
    </div>
  );
};
