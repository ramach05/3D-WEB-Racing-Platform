import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VEHICLE_STORAGE_KEY } from '@/shared/config';
import { renderWithRouter } from '@/test/render';
import { GaragePage } from './garage-page';

vi.mock('@/widgets/vehicle-preview', () => ({
  VehiclePreview: ({ vehicleId }: { vehicleId: string }) => (
    <div data-testid={`vehicle-preview-${vehicleId}`} />
  ),
}));

describe('GaragePage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lists three vehicles and defaults to hatchback selected', () => {
    renderWithRouter(<GaragePage />);

    expect(screen.getByRole('heading', { name: /гараж|garage/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /хэтчбек|hatchback/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /седан|sedan/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /пикап|pickup/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByText(/выбрано|selected/i)).toBeInTheDocument();
    expect(screen.queryByText(/выбрать|select(?!ed)/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('vehicle-preview-hatchback')).toBeInTheDocument();
    expect(screen.getByTestId('vehicle-preview-sedan')).toBeInTheDocument();
    expect(screen.getByTestId('vehicle-preview-pickup')).toBeInTheDocument();
  });

  it('persists selection to localStorage', async () => {
    const user = userEvent.setup();
    renderWithRouter(<GaragePage />);

    await user.click(screen.getByRole('button', { name: /пикап|pickup/i }));

    expect(localStorage.getItem(VEHICLE_STORAGE_KEY)).toBe('pickup');
    expect(screen.getByRole('button', { name: /пикап|pickup/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
