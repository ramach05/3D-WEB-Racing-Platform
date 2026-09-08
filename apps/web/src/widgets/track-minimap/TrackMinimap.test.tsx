import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { coastalOvalTrack } from '@/entities/track';
import { TrackMinimap } from './TrackMinimap';

describe('TrackMinimap', () => {
  it('returns null for short centerline', () => {
    const { container } = render(
      <TrackMinimap config={{ ...coastalOvalTrack, centerline: [{ x: 0, z: 0 }] }} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders svg for real track', () => {
    const { container } = render(<TrackMinimap config={coastalOvalTrack} />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('role', 'img');
    expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
  });
});
