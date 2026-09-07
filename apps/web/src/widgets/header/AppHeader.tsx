import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthUser, useLogout } from '@/features/auth';
import { LocaleSwitcher } from '@/features/locale-switcher';
import { ThemeSwitcher } from '@/features/theme-switcher';
import { cx } from '@/shared/lib';
import { Button } from '@/shared/ui';

type TNavClassArgs = {
  /** Активен ли текущий маршрут */
  isActive: boolean;
};

/** Класс пункта меню: активный маршрут выделяем фоном */
const navClass = ({ isActive }: TNavClassArgs): string =>
  cx(
    'sega-nav-link px-2 py-1.5 text-xs font-medium uppercase md:px-3 md:text-sm',
    isActive
      ? 'bg-[var(--surface-hover)] text-[var(--sega-yellow)]'
      : 'text-[var(--muted)] hover:text-[var(--fg)]',
  );

/** Шапка сайта: навигация, тема, язык, сессия */
export const AppHeader = () => {
  const { t } = useTranslation();
  const user = useAuthUser();
  const logout = useLogout();

  return (
    <header className="border-b-4 border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto grid max-w-5xl grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-2 md:gap-3 md:px-4">
        <NavLink
          to="/"
          className="sega-nav-link shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--sega-cyan)] md:text-sm"
        >
          <span className="hidden sm:inline">{t('meta.product')}</span>
          <span className="sm:hidden">3D RACE</span>
        </NavLink>
        <nav
          aria-label={t('meta.product')}
          className="flex min-w-0 flex-wrap items-center justify-center gap-0.5 md:gap-1"
        >
          <NavLink to="/" className={navClass} end>
            {t('nav.home')}
          </NavLink>
          <NavLink to="/tracks" className={navClass}>
            {t('nav.tracks')}
          </NavLink>
          <NavLink to="/leaderboard" className={navClass}>
            {t('nav.leaderboard')}
          </NavLink>
          <NavLink to="/profile" className={navClass}>
            {t('nav.profile')}
          </NavLink>
          {user ? null : (
            <NavLink to="/login" className={navClass}>
              {t('nav.login')}
            </NavLink>
          )}
        </nav>
        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 md:gap-2">
          {user ? (
            <>
              <span
                className="max-w-[5.5rem] truncate text-xs text-[var(--sega-magenta)] sm:max-w-[8rem] md:max-w-[10rem] md:text-sm"
                title={user.nickname}
              >
                {user.nickname}
              </span>
              <Button variant="ghost" size="sm" onClick={logout}>
                {t('nav.logout')}
              </Button>
            </>
          ) : null}
          <ThemeSwitcher size="sm" />
          <LocaleSwitcher size="sm" />
        </div>
      </div>
    </header>
  );
};
