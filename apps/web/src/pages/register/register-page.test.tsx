import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '@/test/render';

vi.mock('@/features/auth', () => ({
  RegisterForm: () => <form aria-label="register-form" />,
}));

import { RegisterPage } from './register-page';

describe('RegisterPage', () => {
  it('renders register form', () => {
    renderWithRouter(<RegisterPage />);

    expect(screen.getByRole('form', { name: 'register-form' })).toBeInTheDocument();
  });
});
