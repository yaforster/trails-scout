import { describe, expect, it, vi } from 'vitest';
import { selectedLocatorFromStorage } from './popup';

vi.mock('webextension-polyfill', () => ({ default: {} }));

describe('popup storage', () => {
  it('migrates stored CSS and XPath locator pair into candidates', () => {
    expect(
      selectedLocatorFromStorage({
        cssSelector: '#checkout',
        xpath: "//*[@id='checkout']",
        selectedAt: '2026-09-19T00:00:00.000Z',
      }),
    ).toEqual({
      candidates: [
        { locatorType: 'CSS', locatorString: '#checkout', strategy: 'Saved CSS' },
        { locatorType: 'XPATH', locatorString: "//*[@id='checkout']", strategy: 'Saved XPath' },
      ],
      selectedAt: '2026-09-19T00:00:00.000Z',
    });
  });
});
