import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextField } from './text-field';

describe('TextField', () => {
  it('renders full error message without clipping', () => {
    const message =
      'Ник должен содержать от 3 до 20 символов: только латинские буквы, цифры и символ подчёркивания (_).';
    render(<TextField label="Ник" name="nickname" error={message} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(alert.className).toContain('sega-field-error');
  });
});
