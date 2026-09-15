import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import browser from 'webextension-polyfill';
import { startLocatorPicker } from './locator';

vi.mock('webextension-polyfill', () => ({
  default: {
    tabs: {
      query: vi.fn(),
      sendMessage: vi.fn(),
    },
    storage: {
      local: {
        get: vi.fn(),
      },
    },
  },
}));

const tabs = browser.tabs as unknown as {
  query: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
};

describe('locator picker', () => {
  beforeEach(() => {
    tabs.query.mockReset();
    tabs.sendMessage.mockReset();
    globalThis.chrome = {
      scripting: {
        executeScript: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports an error when no active tab id exists', async () => {
    const button = document.createElement('button');
    const setStatus = vi.fn();
    tabs.query.mockResolvedValue([{ url: 'https://example.test' }]);

    await startLocatorPicker(button, setStatus);

    expect(setStatus).toHaveBeenCalledWith('No active tab is available.', 'error');
  });

  it('reports an error for unsupported tab urls', async () => {
    const button = document.createElement('button');
    const setStatus = vi.fn();
    tabs.query.mockResolvedValue([{ id: 7, url: 'chrome://extensions' }]);

    await startLocatorPicker(button, setStatus);

    expect(setStatus).toHaveBeenCalledWith(
      'Open an http or https page before picking a locator.',
      'error',
    );
  });

  it('sends the start inspector message to supported pages', async () => {
    const button = document.createElement('button');
    const setStatus = vi.fn();
    tabs.query.mockResolvedValue([{ id: 7, url: 'https://example.test' }]);
    tabs.sendMessage.mockResolvedValue(undefined);

    await startLocatorPicker(button, setStatus);

    expect(tabs.sendMessage).toHaveBeenCalledWith(7, { type: 'TRAILS_START_INSPECTOR' });
    expect(setStatus).toHaveBeenCalledWith('Click an element in the page. Press Escape to cancel.');
  });

  it('injects the inspector when the content script is unavailable', async () => {
    const button = document.createElement('button');
    const setStatus = vi.fn();
    const executeScript = vi.spyOn(chrome.scripting, 'executeScript');
    tabs.query.mockResolvedValue([{ id: 7, url: 'https://example.test' }]);
    tabs.sendMessage.mockRejectedValue(new Error('Receiving end does not exist'));

    await startLocatorPicker(button, setStatus);

    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      func: expect.any(Function),
    });
  });
});
