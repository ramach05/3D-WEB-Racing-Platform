import type { ReactNode } from 'react';

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

/** Обёртка основной области страницы */
export const PageShell = ({ children, className }: PageShellProps) => {
  return <div className={`mx-auto w-full max-w-5xl px-4 py-8 ${className ?? ''}`}>{children}</div>;
};
