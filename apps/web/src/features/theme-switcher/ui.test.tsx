import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ThemeSwitcher } from './ThemeSwitcher';

describe('ThemeSwitcher', () => {
  it('opens dropdown and switches theme', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);

    await user.click(screen.getByRole('button', { name: /тема|theme/i }));
    await user.click(screen.getByRole('button', { name: /тёмная|dark/i }));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
