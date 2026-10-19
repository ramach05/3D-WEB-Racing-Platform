import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TThemeMode } from '@/shared/config';
import { Select } from '@/shared/ui';
import { applyTheme, readStoredTheme } from './model';

type TThemeSwitcherProps = {
  /** Select trigger size */
  size?: 'md' | 'sm';
};

/** Light/dark theme dropdown persisted to localStorage */
export const ThemeSwitcher = ({ size = 'md' }: TThemeSwitcherProps) => {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<TThemeMode>(readStoredTheme);

  // Sync CSS variables and the dark class with the selected theme
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Applies the selected theme and keeps it in state
  const onChange = useCallback((value: TThemeMode) => {
    setTheme(value);
    applyTheme(value);
  }, []);

  return (
    <Select
      label={t('theme.label')}
      value={theme}
      onChange={onChange}
      size={size}
      options={[
        { value: 'light', label: t('theme.light') },
        { value: 'dark', label: t('theme.dark') },
      ]}
    />
  );
};
