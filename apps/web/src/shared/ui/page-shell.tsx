import type { ReactNode } from 'react';

type TPageShellProps = {
  children: ReactNode;
  className?: string;
};

/** Обёртка основной области страницы */
export const PageShell = ({ children, className }: TPageShellProps) => {
  return <div className={`mx-auto w-full max-w-5xl px-4 py-8 ${className ?? ''}`}>{children}</div>;
};
