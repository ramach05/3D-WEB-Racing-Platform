import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ThemeName } from '@/shared/config';
import { Select } from '@/shared/ui';
import { applyTheme, readStoredTheme } from './model';

type ThemeSwitcherProps = {
  size?: 'md' | 'sm';
};

/** Дропдаун светлая/тёмная тема с сохранением в localStorage */
export const ThemeSwitcher = ({ size = 'md' }: ThemeSwitcherProps) => {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<ThemeName>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const onChange = useCallback((value: ThemeName) => {
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
