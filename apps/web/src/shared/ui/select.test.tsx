import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './select';

describe('Select', () => {
  it('opens and selects an option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select
        label="Track"
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'Coastal Oval' },
          { value: 'b', label: 'Night City' },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Track' }));
    await user.click(screen.getByRole('button', { name: 'Night City' }));

    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('shows the selected label', () => {
    render(
      <Select
        label="Track"
        value="b"
        onChange={() => undefined}
        options={[
          { value: 'a', label: 'Coastal Oval' },
          { value: 'b', label: 'Night City' },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Track' })).toHaveTextContent('Night City');
  });
});
