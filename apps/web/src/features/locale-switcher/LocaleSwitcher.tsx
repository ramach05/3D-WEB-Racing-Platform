import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { persistLocale } from './model';
import type { TAppLocale } from '@/shared/config';
import { Select } from '@/shared/ui';

type TLocaleSwitcherProps = {
  /** Размер триггера селекта */
  size?: 'md' | 'sm';
};

/** Дропдаун языка ru/en */
export const LocaleSwitcher = ({ size = 'md' }: TLocaleSwitcherProps) => {
  const { t, i18n } = useTranslation();
  const locale = (i18n.language === 'en' ? 'en' : 'ru') as TAppLocale;

  /** Меняет язык i18n и сохраняет в storage */
  const onChange = useCallback(
    (next: TAppLocale) => {
      persistLocale(next);
      void i18n.changeLanguage(next);
      document.documentElement.lang = next;
    },
    [i18n],
  );

  return (
    <Select
      label={t('locale.label')}
      value={locale}
      onChange={onChange}
      size={size}
      options={[
        { value: 'ru', label: t('locale.ru') },
        { value: 'en', label: t('locale.en') },
      ]}
    />
  );
};
