import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders children and handles click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Start</Button>);

    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('respects disabled state', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Wait
      </Button>,
    );

    await user.click(screen.getByRole('button', { name: 'Wait' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies ghost variant class', () => {
    render(<Button variant="ghost">Ghost</Button>);

    expect(screen.getByRole('button', { name: 'Ghost' }).className).toContain('sega-btn--ghost');
  });
});
