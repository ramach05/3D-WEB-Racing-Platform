import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageMeta } from './page-meta';

describe('PageMeta', () => {
  afterEach(() => {
    document.title = '';
  });

  it('sets document.title with the product suffix', () => {
    render(<PageMeta title="Garage" />);

    expect(document.title).toBe('Garage — 3D WEB Racing Platform');
  });

  it('replaces the title when the page changes', () => {
    const { rerender } = render(<PageMeta title="Garage" />);
    rerender(<PageMeta title="Tracks" />);

    expect(document.title).toBe('Tracks — 3D WEB Racing Platform');
  });
});
