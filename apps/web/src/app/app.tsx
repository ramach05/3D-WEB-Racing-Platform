import { Provider } from 'react-redux';
import { AuthHydrator } from '@/features/auth';
import { BackendGate } from './backend-gate';
import { AppRouter } from './router';
import { store } from './store';
import './i18n';
import './styles.css';

/** React app root: store + API availability gate + router */
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
