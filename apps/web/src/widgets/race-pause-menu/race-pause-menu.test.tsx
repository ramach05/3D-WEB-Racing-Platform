import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RacePauseMenu } from './race-pause-menu';

describe('RacePauseMenu', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <RacePauseMenu
        open={false}
        onResume={() => undefined}
        onRestart={() => undefined}
        onExit={() => undefined}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('calls actions from buttons', async () => {
    const user = userEvent.setup();
    const onResume = vi.fn();
    const onRestart = vi.fn();
    const onExit = vi.fn();

    render(<RacePauseMenu open onResume={onResume} onRestart={onRestart} onExit={onExit} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /продолжить|resume/i }));
    await user.click(screen.getByRole('button', { name: /рестарт|restart/i }));
    await user.click(screen.getByRole('button', { name: /к трассам|to tracks/i }));

    expect(onResume).toHaveBeenCalledOnce();
    expect(onRestart).toHaveBeenCalledOnce();
    expect(onExit).toHaveBeenCalledOnce();
  });
});
