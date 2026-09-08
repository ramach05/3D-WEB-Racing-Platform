import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { i18n } from '@/test/i18n';
import { LocaleSwitcher } from './locale-switcher';

describe('LocaleSwitcher', () => {
  it('opens dropdown and switches locale', async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher />);

    await user.click(screen.getByRole('button', { name: /язык|language/i }));
    await user.click(screen.getByRole('button', { name: /english/i }));

    expect(i18n.language).toBe('en');
  });
});
