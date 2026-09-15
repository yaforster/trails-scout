import { beforeEach, describe, expect, it, vi } from 'vitest';
import { injectedInspector } from './injected-inspector';

function mockChrome(): {
  storageSet: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  writeText: ReturnType<typeof vi.fn>;
} {
  const storageSet = vi.fn();
  const sendMessage = vi.fn().mockResolvedValue(undefined);
  const writeText = vi.fn().mockResolvedValue(undefined);

  globalThis.chrome = {
    storage: {
      local: {
        set: storageSet,
      },
    },
    runtime: {
      sendMessage,
    },
  } as unknown as typeof chrome;

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });

  return { storageSet, sendMessage, writeText };
}

describe('injected inspector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete (globalThis as unknown as Record<string, unknown>).__trailsScoutInspectorState;
  });

  it('highlights the hovered element', () => {
    mockChrome();
    document.body.innerHTML = `<button id="checkout">Checkout</button>`;
    const button = document.getElementById('checkout')!;
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      left: 20,
      width: 120,
      height: 40,
      right: 140,
      bottom: 50,
      x: 20,
      y: 10,
      toJSON: () => ({}),
    });

    injectedInspector();
    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));

    const overlay = document.documentElement.querySelector('div')!;
    expect(overlay.style.display).toBe('block');
    expect(overlay.style.left).toBe('20px');
    expect(overlay.style.width).toBe('120px');
  });

  it('stores and sends the selected element on click', () => {
    const { storageSet, sendMessage, writeText } = mockChrome();
    document.body.innerHTML = `<button id="checkout">Checkout</button>`;
    const button = document.getElementById('checkout')!;

    injectedInspector();
    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(storageSet).toHaveBeenCalledWith({
      lastSelectedElement: expect.objectContaining({
        cssSelector: '#checkout',
        xpath: `//*[@id="checkout"]`,
      }),
    });
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'TRAILS_ELEMENT_SELECTED',
      cssSelector: '#checkout',
      xpath: `//*[@id="checkout"]`,
    });
    expect(writeText).toHaveBeenCalledWith('#checkout');
  });

  it('stops without selecting when Escape is pressed', () => {
    const { storageSet } = mockChrome();

    injectedInspector();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(storageSet).not.toHaveBeenCalled();
    expect(document.documentElement.querySelector('div')).toBeNull();
  });
});
