import { flattenApiMessage, getErrorMessage } from '@racing/shared';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { describe, expect, it } from 'vitest';
import { getRtkErrorMessage } from './rtk-error';

describe('flattenApiMessage', () => {
  it('keeps a string message', () => {
    expect(flattenApiMessage('Nope')).toBe('Nope');
  });

  it('joins array messages', () => {
    expect(flattenApiMessage(['a', 'b'])).toBe('a, b');
  });
});

describe('getErrorMessage', () => {
  it('prefers error.message when present', () => {
    expect(getErrorMessage({ message: 'boom', toString: () => 'x' })).toBe('boom');
  });

  it('falls back to toString', () => {
    expect(getErrorMessage({ toString: () => 'fallback' })).toBe('fallback');
  });
});

describe('getRtkErrorMessage', () => {
  it('reads FETCH_ERROR text', () => {
    const error = {
      status: 'FETCH_ERROR',
      error: 'Network down',
    } as FetchBaseQueryError;

    expect(getRtkErrorMessage(error)).toBe('Network down');
  });

  it('reads string data body', () => {
    const error = { status: 500, data: 'Server failed' } as FetchBaseQueryError;

    expect(getRtkErrorMessage(error)).toBe('Server failed');
  });

  it('flattens Nest message array', () => {
    const error = {
      status: 400,
      data: { statusCode: 400, message: ['too short', 'invalid'], error: 'Bad Request' },
    } as FetchBaseQueryError;

    expect(getRtkErrorMessage(error)).toBe('too short, invalid');
  });

  it('returns default for empty body', () => {
    const error = { status: 500, data: null } as FetchBaseQueryError;

    expect(getRtkErrorMessage(error)).toBe('Request failed');
  });
});
