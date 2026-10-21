import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthHydrated, useAuthUser, useLogout } from '@/features/auth';
import { LocaleSwitcher } from '@/features/locale-switcher';
import { ThemeSwitcher } from '@/features/theme-switcher';
import { cx } from '@/shared/lib';
import { Button, SegaSkeleton } from '@/shared/ui';

type TNavClassArgs = {
  /** Whether the current route is active */
  isActive: boolean;
};

/** Nav item class: highlight the active route with a background */
const navClass = ({ isActive }: TNavClassArgs): string =>
  cx(
    'sega-nav-link sega-header-nav__link px-1.5 py-2 text-center text-[0.65rem] font-medium uppercase leading-tight sm:text-xs md:px-3 md:py-1.5 md:text-sm',
    isActive ? 'bg-[var(--surface-hover)] text-[var(--sega-yellow)]' : 'text-[var(--muted)]',
  );

/** Site header: navigation, theme, language, session */
export const AppHeader = () => {
  const { t } = useTranslation();
  const user = useAuthUser();
  const hydrated = useAuthHydrated();
  const logout = useLogout();

  // Auth action lives in the top-right: logout for users, login link for guests, skeleton while hydrating
  const authAction = user ? (
    <Button variant="ghost" size="sm" className="whitespace-nowrap" onClick={logout}>
      {t('nav.logout')}
    </Button>
  ) : hydrated ? (
    <NavLink to="/login" className="sega-btn sega-btn--ghost sega-btn--sm whitespace-nowrap">
      {t('nav.login')}
    </NavLink>
  ) : (
    <span role="status" aria-label={t('auth.loading')} className="flex cursor-default items-center">
      <SegaSkeleton className="sega-skeleton--inset h-6 w-16" />
    </span>
  );

  return (
    <header className="border-b-4 border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 md:flex-nowrap md:gap-3 md:px-4">
        <NavLink
          to="/"
          className="sega-nav-link order-1 min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-[var(--sega-cyan)] md:flex-none md:text-sm"
        >
          {t('meta.product')}
        </NavLink>

        <div className="order-2 flex shrink-0 items-center md:order-4">{authAction}</div>

        <div
          role="group"
          aria-label={t('a11y.settings')}
          className="order-3 flex w-full shrink-0 items-center justify-end gap-1.5 [&_.sega-select-trigger]:min-w-0 md:order-3 md:w-auto md:gap-2"
        >
          <ThemeSwitcher size="sm" />
          <LocaleSwitcher size="sm" />
        </div>

        <nav
          aria-label={t('a11y.nav')}
          className="sega-header-nav order-4 w-full md:order-2 md:flex md:w-auto md:min-w-0 md:flex-1 md:flex-wrap md:items-center md:justify-center md:gap-1"
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
        </nav>
      </div>
    </header>
  );
};
