import { Provider } from 'react-redux';
import { AuthHydrator } from '@/features/auth';
import { BackendGate } from './backend-gate';
import { AppRouter } from './router';
import { store } from './store';
import './i18n';
import './styles.css';

/** Корень React-приложения: store + гейт доступности API + роутер */
export const AppProviders = () => {
  return (
    <Provider store={store}>
      <BackendGate>
        <AuthHydrator />
        <AppRouter />
      </BackendGate>
    </Provider>
  );
};
