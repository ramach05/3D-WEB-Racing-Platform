import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coastalOvalTrack } from '@/entities/track';
import { setVehiclePose } from '@/features/race-session';
import { RaceMinimap } from './race-minimap';

const getMarker = (container: HTMLElement): SVGGElement => {
  const marker = container.querySelector<SVGGElement>('svg > g');
  if (!marker) {
    throw new Error('marker group not rendered');
  }
  return marker;
};

const getTransform = (container: HTMLElement): string =>
  getMarker(container).getAttribute('transform') ?? '';

const parseTranslate = (transform: string): { x: number; y: number } => {
  const [x, y] = /translate\(([^)]+)\)/.exec(transform)?.[1]?.split(' ') ?? [];
  return { x: Number(x), y: Number(y) };
};

/** Coastal Oval centerline point (t=0 → ellipse 58×36) */
const ON_CENTERLINE = { x: 58, z: 0 };

describe('RaceMinimap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVehiclePose(0, 0, 0);
  });

  afterEach(() => {
    setVehiclePose(0, 0, 0);
    vi.useRealTimers();
  });

  it('renders track plan with vehicle marker', () => {
    const { container } = render(<RaceMinimap config={coastalOvalTrack} />);

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('svg > g > polygon')).toBeInTheDocument();
  });

  it('rotates marker to vehicle yaw', () => {
    setVehiclePose(ON_CENTERLINE.x, ON_CENTERLINE.z, Math.PI / 2);
    const { container } = render(<RaceMinimap config={coastalOvalTrack} />);

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(getTransform(container)).toContain('rotate(-90.0)');
  });

  it('keeps marker on the centerline regardless of lateral position on the road', () => {
    setVehiclePose(ON_CENTERLINE.x, ON_CENTERLINE.z, 0);
    const { container } = render(<RaceMinimap config={coastalOvalTrack} />);

    act(() => {
      vi.advanceTimersByTime(16);
    });
    const center = parseTranslate(getTransform(container));

    // The car shifted across the road (the normal at this point is along X). The minimap
    // point must stay on the centerline: the shift is at most a micro-error of curvature,
    // not the full lane width.
    setVehiclePose(ON_CENTERLINE.x - 6, ON_CENTERLINE.z, 0);
    act(() => {
      vi.advanceTimersByTime(16);
    });
    const offset = parseTranslate(getTransform(container));

    expect(Math.abs(offset.x - center.x)).toBeLessThan(1.5);
    expect(Math.abs(offset.y - center.y)).toBeLessThan(1.5);
  });

  it('moves marker along the track between frames', () => {
    setVehiclePose(ON_CENTERLINE.x, ON_CENTERLINE.z, 0);
    const { container } = render(<RaceMinimap config={coastalOvalTrack} />);

    act(() => {
      vi.advanceTimersByTime(16);
    });
    const start = parseTranslate(getTransform(container));

    setVehiclePose(-ON_CENTERLINE.x, ON_CENTERLINE.z, 0);
    act(() => {
      vi.advanceTimersByTime(16);
    });
    const moved = parseTranslate(getTransform(container));

    expect(Math.abs(moved.x - start.x)).toBeGreaterThan(50);
  });
});
