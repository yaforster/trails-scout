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
        candidates: [
          { locatorType: 'CSS', locatorString: '#checkout', strategy: 'ID' },
          {
            locatorType: 'CSS',
            locatorString: 'html > body > button',
            strategy: 'Structural path',
          },
          { locatorType: 'XPATH', locatorString: `//*[@id='checkout']`, strategy: 'ID' },
          {
            locatorType: 'XPATH',
            locatorString: '/html[1]/body[1]/button[1]',
            strategy: 'Structural path',
          },
        ],
        selectedAt: expect.any(String),
      }),
    });
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'TRAILS_ELEMENT_SELECTED',
      candidates: expect.arrayContaining([
        { locatorType: 'CSS', locatorString: '#checkout', strategy: 'ID' },
        { locatorType: 'XPATH', locatorString: `//*[@id='checkout']`, strategy: 'ID' },
      ]),
    });
    expect(writeText).toHaveBeenCalledWith('#checkout');
  });

  it('skips colliding stable attributes and keeps structural fallback unique', () => {
    const { storageSet } = mockChrome();
    document.body.innerHTML = `
      <button data-testid="duplicate">First</button>
      <button data-testid="duplicate">Second</button>
    `;
    const button = document.querySelectorAll('button')[1];

    injectedInspector();
    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    const selectedElement = storageSet.mock.calls[0][0].lastSelectedElement;
    expect(selectedElement.candidates).not.toContainEqual(
      expect.objectContaining({ locatorString: 'button[data-testid="duplicate"]' }),
    );
    expect(selectedElement.candidates).toContainEqual({
      locatorType: 'CSS',
      locatorString: 'html > body > button:nth-of-type(2)',
      strategy: 'Structural path',
    });
  });

  it('stops without selecting when Escape is pressed', () => {
    const { storageSet } = mockChrome();

    injectedInspector();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(storageSet).not.toHaveBeenCalled();
    expect(document.documentElement.querySelector('div')).toBeNull();
  });

  it('validates CSS and XPath without evaluating arbitrary code', () => {
    mockChrome();
    document.body.innerHTML = `<button id="checkout"></button>`;

    expect(
      injectedInspector({
        type: 'TRAILS_VALIDATE_LOCATOR',
        requestId: 'css',
        locatorType: 'CSS',
        locatorString: '#checkout',
      }),
    ).toMatchObject({ status: 'unique', matchCount: 1 });
    expect(
      injectedInspector({
        type: 'TRAILS_VALIDATE_LOCATOR',
        requestId: 'xpath',
        locatorType: 'XPATH',
        locatorString: '//*[@id="checkout"]',
      }),
    ).toMatchObject({ status: 'unique', matchCount: 1 });
  });
});
