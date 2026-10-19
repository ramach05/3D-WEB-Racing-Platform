import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '@/shared/lib';

type TSegaLoaderProps = {
  /** Подпись; по умолчанию common.loading */
  label?: ReactNode;
  /** Доп. классы обертки */
  className?: string;
};

/** Аркадный индикатор загрузки (LOADING + blink dots) */
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
