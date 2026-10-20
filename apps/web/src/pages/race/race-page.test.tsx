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
  /** onFirstFrame callback the test fires manually instead of a real scene render */
  firstFrame: null as null | (() => void),
  /** autoplay gate state the mocked page hook reports */
  awaitingGesture: false,
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
  useAudioAutoplayGate: () => mocks.awaitingGesture,
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
import { useRaceAudio } from '@/features/race-audio';
import { RacePage } from './race-page';

const mockedUseGetTracksQuery = vi.mocked(useGetTracksQuery);
const mockedUseGetLeaderboardQuery = vi.mocked(useGetLeaderboardQuery);
const mockedUseRaceAudio = vi.mocked(useRaceAudio);

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
    mockedUseRaceAudio.mockReset();
    mocks.firstFrame = null;
    mocks.awaitingGesture = false;
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

  it('shows the track loader and hides it after the first scene frame', async () => {
    renderPage(<RacePage />);

    expect(screen.getByText(/готовим трассу/i)).toBeInTheDocument();
    expect(screen.queryByTestId('race-canvas')).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId('race-canvas')).toBeInTheDocument());
    // Canvas is mounted but there is no first frame yet: loader and HUD gate are still in place.
    expect(screen.getByText(/готовим трассу/i)).toBeInTheDocument();

    act(() => {
      mocks.firstFrame?.();
    });

    await waitFor(() => expect(screen.queryByText(/готовим трассу/i)).not.toBeInTheDocument());
    expect(screen.getByText('Coastal Oval')).toBeInTheDocument();
  });

  it('keeps music disabled in ready state and shows the press-start hint while audio is gated', async () => {
    mocks.awaitingGesture = true;
    renderPage(<RacePage />);

    await waitFor(() => expect(screen.getByTestId('race-canvas')).toBeInTheDocument());
    act(() => {
      mocks.firstFrame?.();
    });

    expect(screen.getByText(/жми любую клавишу/i)).toBeInTheDocument();
    // Before the countdown (status 'ready') the music engine must stay disabled
    expect(mockedUseRaceAudio.mock.calls[0]?.[0]?.enabled).toBe(false);
  });
});
