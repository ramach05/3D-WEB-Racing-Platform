import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { readStoredLocale } from '@/features/locale-switcher';
import { enMessages, ruMessages } from '@/shared/config';

const locale = readStoredLocale();

void i18n.use(initReactI18next).init({
  lng: locale,
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
  resources: {
    ru: { translation: ruMessages },
    en: { translation: enMessages },
  },
});

document.documentElement.lang = locale;

export { i18n };
