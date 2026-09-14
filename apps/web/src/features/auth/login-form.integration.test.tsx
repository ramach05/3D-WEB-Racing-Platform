import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { getApiBaseUrl } from '@/shared/config';
import { clearAuthSession, readAuthSession } from '@/shared/lib';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { LoginForm } from './login-form';

const api = getApiBaseUrl();

describe('LoginForm integration', () => {
  it('persists access token after successful login', async () => {
    clearAuthSession();
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />, { initialEntries: ['/login'] });

    await user.type(screen.getByLabelText(/ник|nickname/i), 'racer_one');
    await user.type(screen.getByLabelText(/пароль|password/i), '1234');
    await user.click(screen.getByRole('button', { name: /войти|log in/i }));

    await waitFor(() => {
      expect(readAuthSession()).toEqual({ accessToken: 'access-token' });
    });
  });

  it('shows api error on unauthorized login', async () => {
    server.use(
      http.post(`${api}/auth/login`, () =>
        HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/ник|nickname/i), 'racer_one');
    await user.type(screen.getByLabelText(/пароль|password/i), '1234');
    await user.click(screen.getByRole('button', { name: /войти|log in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid credentials/i);
  });
});
