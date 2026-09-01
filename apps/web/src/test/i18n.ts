import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { enMessages, ruMessages } from '@/shared/config';

void i18n.use(initReactI18next).init({
  lng: 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
  resources: {
    ru: { translation: ruMessages },
    en: { translation: enMessages },
  },
});

export { i18n };
