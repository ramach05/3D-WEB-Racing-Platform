import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TThemeMode } from '@/shared/config';
import { Select } from '@/shared/ui';
import { applyTheme, readStoredTheme } from './model';

type TThemeSwitcherProps = {
  /** Размер триггера селекта */
  size?: 'md' | 'sm';
};

/** Дропдаун светлая/темная тема с сохранением в localStorage */
export const ThemeSwitcher = ({ size = 'md' }: TThemeSwitcherProps) => {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<TThemeMode>(readStoredTheme);

  // Синхронизируем CSS-переменные и class dark с выбранной темой
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Применяет выбранную тему и сохраняет в state
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
