import type { ReactNode } from 'react';
import { cx } from '@/shared/lib';

type TPageShellProps = {
  /** Контент страницы */
  children: ReactNode;
  /** Доп. классы внутренней обертки */
  className?: string;
};

/** Обертка основной области: full-bleed scanlines + узкий контент */
export const PageShell = ({ children, className }: TPageShellProps) => {
  return (
    <div className="sega-scanlines relative min-h-0 w-full flex-1 overflow-hidden">
      <div className={cx('relative mx-auto w-full max-w-5xl px-4 py-8', className)}>{children}</div>
    </div>
  );
};
