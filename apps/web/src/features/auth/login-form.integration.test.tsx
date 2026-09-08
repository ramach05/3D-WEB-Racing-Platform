import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AUTH_STORAGE_KEY, getApiBaseUrl } from '@/shared/config';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { LoginForm } from './login-form';

const api = getApiBaseUrl();

describe('LoginForm integration', () => {
  it('persists tokens after successful login', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />, { initialEntries: ['/login'] });

    await user.type(screen.getByLabelText(/ник|nickname/i), 'racer_one');
    await user.type(screen.getByLabelText(/пароль|password/i), '1234');
    await user.click(screen.getByRole('button', { name: /войти|log in/i }));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? '')).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
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
