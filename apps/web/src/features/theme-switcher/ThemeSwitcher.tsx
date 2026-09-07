import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TThemeName } from '@/shared/config';
import { Select } from '@/shared/ui';
import { applyTheme, readStoredTheme } from './model';

type TThemeSwitcherProps = {
  size?: 'md' | 'sm';
};

/** Дропдаун светлая/тёмная тема с сохранением в localStorage */
export const ThemeSwitcher = ({ size = 'md' }: TThemeSwitcherProps) => {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<TThemeName>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const onChange = useCallback((value: TThemeName) => {
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
