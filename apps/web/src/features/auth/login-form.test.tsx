import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '@/test/render';

const loginMock = vi.fn();

vi.mock('./api', () => ({
  useLoginMutation: () => [loginMock, { isLoading: false }],
}));

import { LoginForm } from './login-form';

describe('LoginForm', () => {
  beforeEach(() => {
    loginMock.mockReset();
    loginMock.mockReturnValue({ unwrap: () => Promise.resolve() });
  });

  it('shows validation error for empty nickname', async () => {
    const user = userEvent.setup();
    renderWithRouter(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /войти|log in/i }));

    expect(await screen.findAllByRole('alert')).toHaveLength(2);
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('submits valid credentials', async () => {
    const user = userEvent.setup();
    renderWithRouter(<LoginForm />);

    await user.type(screen.getByLabelText(/ник|nickname/i), 'test_user');
    await user.type(screen.getByLabelText(/пароль|password/i), '1234');
    await user.click(screen.getByRole('button', { name: /войти|log in/i }));

    expect(loginMock).toHaveBeenCalledWith({
      nickname: 'test_user',
      password: '1234',
    });
  });
});
