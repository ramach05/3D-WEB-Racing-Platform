import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '@/test/render';

const registerMock = vi.fn();

vi.mock('./api', () => ({
  useRegisterMutation: () => [registerMock, { isLoading: false }],
}));

import { RegisterForm } from './register-form';

describe('RegisterForm', () => {
  beforeEach(() => {
    registerMock.mockReset();
    registerMock.mockReturnValue({ unwrap: () => Promise.resolve() });
  });

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    renderWithRouter(<RegisterForm />);

    await user.click(screen.getByRole('button', { name: /создать аккаунт|create account/i }));

    expect(await screen.findAllByRole('alert')).toHaveLength(2);
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('submits valid credentials', async () => {
    const user = userEvent.setup();
    renderWithRouter(<RegisterForm />);

    await user.type(screen.getByLabelText(/ник|nickname/i), 'new_racer');
    await user.type(screen.getByLabelText(/пароль|password/i), '1234');
    await user.click(screen.getByRole('button', { name: /создать аккаунт|create account/i }));

    expect(registerMock).toHaveBeenCalledWith({
      nickname: 'new_racer',
      password: '1234',
    });
  });
});
