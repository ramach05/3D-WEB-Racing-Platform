/** Partial RTK Query result for unit mocks. The full UseQueryHookResult is too heavy; the never-cast bypasses the overlap-check without unknown. */
export const mockQueryResult = <T>(partial: object): T =>
  ({
    refetch: () => undefined,
    ...partial,
  }) as never as T;
