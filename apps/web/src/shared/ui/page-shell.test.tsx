import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageShell } from './page-shell';

describe('PageShell', () => {
  it('renders children', () => {
    render(
      <PageShell>
        <p>Page body</p>
      </PageShell>,
    );

    expect(screen.getByText('Page body')).toBeInTheDocument();
  });

  it('appends className', () => {
    const { container } = render(
      <PageShell className="extra-class">
        <span>x</span>
      </PageShell>,
    );

    expect(container.firstChild).toHaveClass('extra-class');
  });
});
