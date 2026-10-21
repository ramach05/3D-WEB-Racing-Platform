import { describe, expect, it } from 'vitest';
import { toUserPublic } from './user-mapper';

describe('toUserPublic', () => {
  it('maps public fields and iso date', () => {
    const createdAt = new Date('2024-06-15T12:00:00.000Z');
    const result = toUserPublic({
      id: 'u1',
      nickname: 'racer',
      createdAt,
    });

    expect(result).toEqual({
      id: 'u1',
      nickname: 'racer',
      createdAt: '2024-06-15T12:00:00.000Z',
    });
    expect(result).not.toHaveProperty('passwordHash');
  });
});
