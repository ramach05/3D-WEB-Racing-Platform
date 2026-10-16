import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestStore } from '@/test/render';
import { useBackendStatus } from './model';

describe('useBackendStatus', () => {
  it('switches to ready after the first health response', async () => {
    const store = createTestStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useBackendStatus(), { wrapper });
    expect(result.current).toBe('booting');

    await waitFor(() => {
      expect(result.current).toBe('ready');
    });
  });
});
