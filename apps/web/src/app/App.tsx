import { Provider } from 'react-redux';
import { AuthHydrator } from '@/features/auth';
import { AppRouter } from './router';
import { store } from './store';
import './i18n';
import './styles.css';

/** Корень React-приложения: store + роутер */
export const AppProviders = () => {
  return (
    <Provider store={store}>
      <AuthHydrator />
      <AppRouter />
    </Provider>
  );
};
