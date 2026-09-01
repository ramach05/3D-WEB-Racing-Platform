import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

/** Рендер с роутером для форм и ссылок */
export const renderWithRouter = (ui: ReactElement): RenderResult => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};
