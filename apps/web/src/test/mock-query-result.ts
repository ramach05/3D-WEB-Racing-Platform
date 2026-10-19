/** Частичный результат RTK Query для unit-моков. Полный UseQueryHookResult слишком тяжелый; never-cast обходит overlap-check без unknown. */
export const mockQueryResult = <T>(partial: object): T =>
  ({
    refetch: () => undefined,
    ...partial,
  }) as never as T;
