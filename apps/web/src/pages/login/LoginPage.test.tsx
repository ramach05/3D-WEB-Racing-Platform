import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '@/test/render';

vi.mock('@/features/auth', () => ({
  LoginForm: () => <form aria-label="login-form" />,
}));

import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('renders login form', () => {
    renderWithRouter(<LoginPage />);

    expect(screen.getByRole('form', { name: 'login-form' })).toBeInTheDocument();
  });
});
