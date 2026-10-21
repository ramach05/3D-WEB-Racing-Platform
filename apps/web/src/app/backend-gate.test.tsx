import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as backendStatusFeature from '@/features/backend-status';
import { useBackendStatus } from '@/features/backend-status';
import { createTestStore } from '@/test/render';
import { BackendGate } from './backend-gate';

vi.mock('@/features/backend-status', async (importOriginal) => {
  const actual = await importOriginal<typeof backendStatusFeature>();
  return { ...actual, useBackendStatus: vi.fn() };
});

const mockedStatus = vi.mocked(useBackendStatus);

const renderGate = (store: ReturnType<typeof createTestStore>) => {
  return render(
    <Provider store={store}>
      <BackendGate>
        <p>app-content</p>
      </BackendGate>
    </Provider>,
  );
};

const rerenderGate = (
  view: { rerender: (ui: ReactNode) => void },
  store: ReturnType<typeof createTestStore>,
) => {
  view.rerender(
    <Provider store={store}>
      <BackendGate>
        <p>app-content</p>
      </BackendGate>
    </Provider>,
  );
};

describe('BackendGate', () => {
  beforeEach(() => {
    mockedStatus.mockReset();
  });

  it('hides app content while backend is booting', () => {
    mockedStatus.mockReturnValue('booting');
    renderGate(createTestStore());

    expect(screen.queryByText('app-content')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/подключаемся к серверу/i);
  });

  it('renders app content when backend is ready', () => {
    mockedStatus.mockReturnValue('ready');
    renderGate(createTestStore());

    expect(screen.getByText('app-content')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps the app mounted and shows a banner when connection is lost', () => {
    mockedStatus.mockReturnValue('lost');
    renderGate(createTestStore());

    expect(screen.getByText('app-content')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/связь с сервером потеряна/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/ready-steady-go/i);
  });

  it('invalidates cached tags after the backend comes back', () => {
    mockedStatus.mockReturnValue('ready');
    const store = createTestStore();
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    const view = renderGate(store);

    mockedStatus.mockReturnValue('lost');
    rerenderGate(view, store);

    mockedStatus.mockReturnValue('ready');
    rerenderGate(view, store);

    const actions = dispatchSpy.mock.calls.map(([action]) => action.type);
    expect(actions.some((type) => type.includes('invalidateTags'))).toBe(true);
  });
});
