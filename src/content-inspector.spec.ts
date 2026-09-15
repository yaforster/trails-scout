import { beforeEach, describe, expect, it, vi } from 'vitest';

const browserMock = vi.hoisted(() => ({
  listeners: [] as Array<(message: unknown) => void>,
  sendMessage: vi.fn().mockResolvedValue(undefined),
  storageSet: vi.fn(),
}));

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      onMessage: {
        addListener: (listener: (message: unknown) => void) => {
          browserMock.listeners.push(listener);
        },
      },
      sendMessage: browserMock.sendMessage,
    },
    storage: {
      local: {
        set: browserMock.storageSet,
      },
    },
  },
}));

function mockClipboard(): ReturnType<typeof vi.fn> {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

describe('content inspector', () => {
  beforeEach(() => {
    vi.resetModules();
    browserMock.listeners.length = 0;
    browserMock.sendMessage.mockClear();
    browserMock.storageSet.mockClear();
    document.body.innerHTML = '';
  });

  it('registers a runtime message listener', async () => {
    await import('./content-inspector');

    expect(browserMock.listeners).toHaveLength(1);
  });

  it('ignores unrelated messages', async () => {
    await import('./content-inspector');

    browserMock.listeners[0]({ type: 'OTHER' });

    expect(document.documentElement.querySelector('div')).toBeNull();
  });

  it('starts the inspector and selects clicked elements', async () => {
    const writeText = mockClipboard();
    document.body.innerHTML = `<button id="checkout">Checkout</button>`;
    await import('./content-inspector');

    browserMock.listeners[0]({ type: 'TRAILS_START_INSPECTOR' });
    const button = document.getElementById('checkout')!;
    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(browserMock.storageSet).toHaveBeenCalledWith({
      lastSelectedElement: expect.objectContaining({
        cssSelector: '#checkout',
        xpath: `//*[@id="checkout"]`,
      }),
    });
    expect(browserMock.sendMessage).toHaveBeenCalledWith({
      type: 'TRAILS_ELEMENT_SELECTED',
      cssSelector: '#checkout',
      xpath: `//*[@id="checkout"]`,
    });
    expect(writeText).toHaveBeenCalledWith('#checkout');
  });

  it('cancels the inspector with Escape', async () => {
    await import('./content-inspector');

    browserMock.listeners[0]({ type: 'TRAILS_START_INSPECTOR' });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(document.documentElement.querySelector('div')).toBeNull();
  });
});
