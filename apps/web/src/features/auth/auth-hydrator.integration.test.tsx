import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { getApiBaseUrl } from '@/shared/config';
import { clearAuthSession, readAuthSession } from '@/shared/lib';
import { mockMe } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { AuthHydrator } from './hooks';

const api = getApiBaseUrl();

describe('AuthHydrator integration', () => {
  it('never marks hydrated while a logged-in user is still unresolved by /auth/me', async () => {
    clearAuthSession();
    let releaseMe: () => void = () => undefined;
    const meGate = new Promise<void>((resolve) => {
      releaseMe = resolve;
    });
    let refreshCalled = false;
    server.use(
      http.post(`${api}/auth/refresh`, () => {
        refreshCalled = true;
        return HttpResponse.json({ tokens: { accessToken: 'access-token' } });
      }),
      http.get(`${api}/auth/me`, async () => {
        await meGate;
        return HttpResponse.json(mockMe);
      }),
    );

    const { store } = renderWithProviders(<AuthHydrator />);
    const observed: boolean[] = [];
    const record = () => {
      const { auth } = store.getState();
      observed.push(auth.hydrated && auth.user === null);
    };
    const unsubscribe = store.subscribe(record);

    await waitFor(() => expect(refreshCalled).toBe(true));
    await waitFor(() => expect(readAuthSession()).toEqual({ accessToken: 'access-token' }));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    // /auth/me is still pending: the store must not claim a settled guest state
    expect(store.getState().auth.hydrated).toBe(false);

    releaseMe();
    await waitFor(() => {
      const { auth } = store.getState();
      expect(auth.hydrated).toBe(true);
      expect(auth.user?.nickname).toBe(mockMe.user.nickname);
    });
    unsubscribe();
    expect(observed.every((badState) => !badState)).toBe(true);
  });
});
