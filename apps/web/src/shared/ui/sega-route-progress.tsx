import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const ROUTE_PROGRESS_MS = 550;

/** Thin SEGA bar on route change / page reload */
export const SegaRouteProgress = () => {
  const { pathname } = useLocation();
  const [shownPath, setShownPath] = useState<string | null>(pathname);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Route change restarts the bar: state is adjusted during render (React pattern)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setShownPath(pathname);
  }

  useEffect(() => {
    if (shownPath === null) {
      return undefined;
    }
    const timerId = window.setTimeout(() => {
      setShownPath(null);
    }, ROUTE_PROGRESS_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [shownPath]);

  if (shownPath === null) {
    return null;
  }

  return <div key={shownPath} className="sega-route-progress" aria-hidden="true" />;
};
