import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SegaLoader } from './sega-loader';

describe('SegaLoader', () => {
  it('renders status region with default loading label', () => {
    render(<SegaLoader />);

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent(/LOADING/i);
  });

  it('renders custom label', () => {
    render(<SegaLoader label="Загружаем трассы…" />);

    expect(screen.getByRole('status')).toHaveTextContent(/Загружаем трассы/i);
  });
});
