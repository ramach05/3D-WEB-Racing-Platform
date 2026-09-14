import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RaceControls } from './race-controls';

describe('RaceControls', () => {
  it('lists hotkeys under controls label', () => {
    render(<RaceControls />);

    expect(screen.getByLabelText(/управление|controls/i)).toBeInTheDocument();
    expect(screen.getByText(/газ|throttle/i)).toBeInTheDocument();
    expect(screen.getByText(/тормоз и назад|brake \/ reverse/i)).toBeInTheDocument();
    expect(screen.getByText(/ручник|handbrake/i)).toBeInTheDocument();
    expect(screen.getByText(/руль|steer/i)).toBeInTheDocument();
  });
});
