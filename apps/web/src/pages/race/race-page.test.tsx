import type * as trackEntity from '@/entities/track';
import type * as reactRouterDom from 'react-router-dom';
import type * as leaderboardEntity from '@/entities/leaderboard';
import type * as raceResultEntity from '@/entities/race-result';
import type * as authFeature from '@/features/auth';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { TRACK_SLUG_COASTAL_OVAL } from '@racing/shared';
import { mockQueryResult } from '@/test/mock-query-result';
import { createTestStore } from '@/test/render';

const mocks = vi.hoisted(() => ({
  /** Колбэк onFirstFrame, который тест дергает вручную вместо реального рендера сцены */
  firstFrame: null as null | (() => void),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof reactRouterDom>();
  return { ...actual, useParams: () => ({ trackSlug: TRACK_SLUG_COASTAL_OVAL }) };
});

vi.mock('@/entities/track', async (importOriginal) => {
  const actual = await importOriginal<typeof trackEntity>();
  return { ...actual, useGetTracksQuery: vi.fn() };
});

vi.mock('@/entities/leaderboard', async (importOriginal) => {
  const actual = await importOriginal<typeof leaderboardEntity>();
  return { ...actual, useGetLeaderboardQuery: vi.fn() };
});

vi.mock('@/entities/race-result', async (importOriginal) => {
  const actual = await importOriginal<typeof raceResultEntity>();
  return {
    ...actual,
    useCreateRaceResultMutation: () => [vi.fn(() => ({ unwrap: () => Promise.resolve() }))],
  };
});

vi.mock('@/features/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof authFeature>();
  return { ...actual, useAuthUser: () => null };
});

vi.mock('@/features/race-audio', () => ({
  useRaceAudio: vi.fn(),
  useRaceDrivingSfx: vi.fn(),
}));

vi.mock('@/widgets/race-canvas', () => ({
  RaceCanvas: ({ onFirstFrame }: { onFirstFrame?: () => void }) => {
    mocks.firstFrame = onFirstFrame ?? null;
    return <div data-testid="race-canvas" />;
  },
  RaceRainOverlay: () => null,
  preloadVehicleModel: vi.fn(),
  VehicleModel: () => null,
  resetSkidMarks: vi.fn(),
  cycleCameraMode: vi.fn(),
  resetCameraMode: vi.fn(),
  useCameraMode: () => 'chase',
  resetCameraShake: vi.fn(),
  pulseCameraShake: vi.fn(),
}));

import { useGetLeaderboardQuery } from '@/entities/leaderboard';
import { useGetTracksQuery } from '@/entities/track';
import { RacePage } from './race-page';

const mockedUseGetTracksQuery = vi.mocked(useGetTracksQuery);
const mockedUseGetLeaderboardQuery = vi.mocked(useGetLeaderboardQuery);

type TTracksQuery = ReturnType<typeof useGetTracksQuery>;
type TLeaderboardQuery = ReturnType<typeof useGetLeaderboardQuery>;

const providers = (ui: ReactElement, store: ReturnType<typeof createTestStore>) => (
  <Provider store={store}>
    <MemoryRouter>{ui}</MemoryRouter>
  </Provider>
);

const renderPage = (ui: ReactElement) => {
  const store = createTestStore();
  return { store, ...render(providers(ui, store)) };
};

describe('RacePage', () => {
  beforeEach(() => {
    mockedUseGetTracksQuery.mockReset();
    mockedUseGetLeaderboardQuery.mockReset();
    mocks.firstFrame = null;
    mockedUseGetTracksQuery.mockReturnValue(
      mockQueryResult<TTracksQuery>({
        data: [
          { id: 't1', slug: TRACK_SLUG_COASTAL_OVAL, name: 'Coastal Oval', isAvailable: true },
        ],
        isLoading: false,
        isError: false,
      }),
    );
    mockedUseGetLeaderboardQuery.mockReturnValue(
      mockQueryResult<TLeaderboardQuery>({ data: [], isLoading: false, isError: false }),
    );
  });

  it('показывает лоадер трассы и скрывает его после первого кадра сцены', async () => {
    renderPage(<RacePage />);

    expect(screen.getByText(/готовим трассу/i)).toBeInTheDocument();
    expect(screen.queryByTestId('race-canvas')).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId('race-canvas')).toBeInTheDocument());
    // Canvas смонтирован, но первого кадра ещё не было: лоадер и HUD-гейт на месте.
    expect(screen.getByText(/готовим трассу/i)).toBeInTheDocument();

    act(() => {
      mocks.firstFrame?.();
    });

    await waitFor(() => expect(screen.queryByText(/готовим трассу/i)).not.toBeInTheDocument());
    expect(screen.getByText('Coastal Oval')).toBeInTheDocument();
  });
});
