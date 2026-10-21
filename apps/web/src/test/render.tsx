import { configureStore } from '@reduxjs/toolkit';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { authReducer } from '@/features/auth';
import { backendReducer } from '@/features/backend-status';
import { racingApi } from '@/shared/api';
import '@/entities/leaderboard';
import '@/entities/race-result';
import '@/entities/track';

export const renderWithRouter = (ui: ReactElement): RenderResult => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

type TRenderWithProvidersOptions = {
  initialEntries?: string[];
};

export const createTestStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      backend: backendReducer,
      [racingApi.reducerPath]: racingApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(racingApi.middleware),
  });

export const renderWithProviders = (
  ui: ReactElement,
  options: TRenderWithProvidersOptions = {},
): RenderResult & { store: ReturnType<typeof createTestStore> } => {
  const store = createTestStore();
  const result = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={options.initialEntries}>{ui}</MemoryRouter>
    </Provider>,
  );
  return { ...result, store };
};
