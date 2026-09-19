import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  hasUnexpiredToken,
  toElementDefinition,
  tokenIconName,
} from './token-utils';
import type { LocatorCandidate } from './types';

const locator: LocatorCandidate = {
  locatorType: 'CSS',
  locatorString: '#checkout',
  strategy: 'ID',
};

describe('token utils', () => {
  describe('hasUnexpiredToken', () => {
    it('returns true when a token expires in the future', () => {
      expect(hasUnexpiredToken('token', 2_000, 1_000)).toBe(true);
    });

    it('returns false when the token is missing', () => {
      expect(hasUnexpiredToken(null, 2_000, 1_000)).toBe(false);
    });

    it('returns false when the expiry is in the past', () => {
      expect(hasUnexpiredToken('token', 1_000, 2_000)).toBe(false);
    });
  });

  describe('toElementDefinition', () => {
    it('creates a trimmed element definition', () => {
      const result = toElementDefinition(locator, 'BUTTON', ' Checkout ');

      expect(result).toEqual({
        valid: true,
        definition: {
          type: 'BUTTON',
          label: 'Checkout',
          locatorString: '#checkout',
          locatorType: 'CSS',
        },
      });
    });

    it('rejects missing locators', () => {
      const result = toElementDefinition(null, 'BUTTON', 'Checkout');

      expect(result).toEqual({
        valid: false,
        message: 'Pick a locator before creating an element.',
      });
    });

    it('rejects blank labels', () => {
      const result = toElementDefinition(locator, 'BUTTON', '   ');

      expect(result).toEqual({
        valid: false,
        message: 'Element label is required.',
      });
    });
  });

  describe('formatDuration', () => {
    it('formats sub-minute durations', () => {
      expect(formatDuration(1_200)).toBe('2s');
    });

    it('formats minute durations with two digit seconds', () => {
      expect(formatDuration(61_000)).toBe('1m 01s');
    });

    it('clamps negative durations to zero', () => {
      expect(formatDuration(-1)).toBe('0s');
    });
  });

  describe('tokenIconName', () => {
    it('maps success to the check icon', () => {
      expect(tokenIconName('success')).toBe('circle-check');
    });

    it('maps error to the alert icon', () => {
      expect(tokenIconName('error')).toBe('circle-alert');
    });

    it('maps pending to the loader icon', () => {
      expect(tokenIconName('pending')).toBe('loader-circle');
    });
  });
});
