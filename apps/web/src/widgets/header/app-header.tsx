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
    'sega-nav-link sega-header-nav__link px-1.5 py-2 text-center text-[0.65rem] font-medium uppercase leading-tight sm:text-xs md:px-3 md:py-1.5 md:text-sm',
    isActive ? 'bg-[var(--surface-hover)] text-[var(--sega-yellow)]' : 'text-[var(--muted)]',
  );

/** Шапка сайта: навигация, тема, язык, сессия */
export const AppHeader = () => {
  const { t } = useTranslation();
  const user = useAuthUser();
  const logout = useLogout();
  const navCols = user ? 5 : 6;

  return (
    <header className="border-b-4 border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-3 py-2 md:grid md:grid-cols-[auto_1fr_auto] md:items-center md:gap-3 md:px-4">
        <div className="flex items-center justify-between gap-2 md:contents">
          <NavLink
            to="/"
            className="sega-nav-link min-w-0 shrink text-xs font-semibold uppercase tracking-wide text-[var(--sega-cyan)] md:col-start-1 md:row-start-1 md:shrink-0 md:text-sm"
          >
            {t('meta.product')}
          </NavLink>

          <div className="flex min-w-0 items-center justify-end gap-1.5 md:col-start-3 md:row-start-1 md:gap-2">
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
            <div
              role="group"
              aria-label={t('a11y.settings')}
              className="flex shrink-0 items-center gap-1.5 md:gap-2"
            >
              <ThemeSwitcher size="sm" />
              <LocaleSwitcher size="sm" />
            </div>
          </div>
        </div>

        <nav
          aria-label={t('a11y.nav')}
          className="sega-header-nav w-full md:col-start-2 md:row-start-1 md:flex md:min-w-0 md:flex-wrap md:items-center md:justify-center md:gap-1"
          style={{ ['--sega-nav-cols' as string]: String(navCols) }}
        >
          <NavLink to="/" className={navClass} end>
            <span className="sega-header-nav__label">{t('nav.home')}</span>
          </NavLink>
          <NavLink to="/tracks" className={navClass}>
            <span className="sega-header-nav__label">{t('nav.tracks')}</span>
          </NavLink>
          <NavLink to="/garage" className={navClass}>
            <span className="sega-header-nav__label">{t('nav.garage')}</span>
          </NavLink>
          <NavLink to="/leaderboard" className={navClass}>
            <span className="sega-header-nav__label">{t('nav.leaderboard')}</span>
          </NavLink>
          <NavLink to="/profile" className={navClass}>
            <span className="sega-header-nav__label">{t('nav.profile')}</span>
          </NavLink>
          {user ? null : (
            <NavLink to="/login" className={navClass}>
              <span className="sega-header-nav__label">{t('nav.login')}</span>
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
};
