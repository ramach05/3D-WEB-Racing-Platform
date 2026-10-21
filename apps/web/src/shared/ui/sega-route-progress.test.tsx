import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SegaRouteProgress } from './sega-route-progress';

const NavigateButton = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/tracks')}>
      Go
    </button>
  );
};

describe('SegaRouteProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows progress on mount and hides after timeout', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <SegaRouteProgress />
      </MemoryRouter>,
    );

    expect(container.querySelector('.sega-route-progress')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(550);
    });

    expect(container.querySelector('.sega-route-progress')).not.toBeInTheDocument();
  });

  it('shows progress again on pathname change', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <SegaRouteProgress />
        <Routes>
          <Route path="/" element={<NavigateButton />} />
          <Route path="/tracks" element={<p>Tracks</p>} />
        </Routes>
      </MemoryRouter>,
    );

    act(() => {
      vi.advanceTimersByTime(550);
    });
    expect(container.querySelector('.sega-route-progress')).not.toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: 'Go' }).click();
    });

    expect(container.querySelector('.sega-route-progress')).toBeInTheDocument();
  });
});
