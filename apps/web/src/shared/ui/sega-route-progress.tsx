import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const ROUTE_PROGRESS_MS = 550;

/** Тонкая SEGA-полоска при смене маршрута / обновлении страницы */
export const SegaRouteProgress = () => {
  const { pathname } = useLocation();
  const [activePath, setActivePath] = useState<string | null>(pathname);

  useEffect(() => {
    setActivePath(pathname);
    const timerId = window.setTimeout(() => {
      setActivePath(null);
    }, ROUTE_PROGRESS_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [pathname]);

  if (activePath === null) {
    return null;
  }

  return <div key={activePath} className="sega-route-progress" aria-hidden="true" />;
};
