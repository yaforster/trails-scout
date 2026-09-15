import { describe, expect, it, vi } from 'vitest';
import {
  hasId,
  isRecord,
  isSelectedLocatorMessage,
  readErrorMessage,
  readJsonResponse,
  trimTrailingSlash,
} from './utils';

vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        get: vi.fn(),
      },
    },
    tabs: {
      query: vi.fn(),
    },
  },
}));

describe('popup utils', () => {
  describe('readJsonResponse', () => {
    it('parses a JSON response body', async () => {
      const response = new Response(JSON.stringify({ status: 'ok' }));

      const result = await readJsonResponse<{ status: string }>(response);

      expect(result).toEqual({ status: 'ok' });
    });

    it('returns an empty object when the response body is empty', async () => {
      const response = new Response('');

      const result = await readJsonResponse<Record<string, never>>(response);

      expect(result).toEqual({});
    });
  });

  describe('readErrorMessage', () => {
    it('uses detail before other error fields', () => {
      const result = readErrorMessage(
        {
          detail: 'Detailed failure',
          message: 'Generic failure',
        },
        'Fallback failure',
      );

      expect(result).toBe('Detailed failure');
    });

    it('uses the fallback when no known error field is usable', () => {
      const result = readErrorMessage({ message: '   ' }, 'Fallback failure');

      expect(result).toBe('Fallback failure');
    });
  });

  describe('trimTrailingSlash', () => {
    it('trims whitespace and one trailing slash', () => {
      const result = trimTrailingSlash(' https://trails.local/ ');

      expect(result).toBe('https://trails.local');
    });
  });

  describe('type guards', () => {
    it('detects records', () => {
      expect(isRecord({ id: 1 })).toBe(true);
    });

    it('rejects null as a record', () => {
      expect(isRecord(null)).toBe(false);
    });

    it('detects values with an id', () => {
      expect(hasId({ id: 7 })).toBe(true);
    });

    it('detects selected locator messages', () => {
      const result = isSelectedLocatorMessage({
        type: 'TRAILS_ELEMENT_SELECTED',
        cssSelector: '#checkout',
        xpath: "//*[@id='checkout']",
      });

      expect(result).toBe(true);
    });

    it('rejects selected locator messages without an xpath', () => {
      const result = isSelectedLocatorMessage({
        type: 'TRAILS_ELEMENT_SELECTED',
        cssSelector: '#checkout',
      });

      expect(result).toBe(false);
    });
  });
});
