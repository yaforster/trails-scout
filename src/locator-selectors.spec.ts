import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSelectedElement,
  generateCssSelector,
  generateXPath,
  isInspectorMessage,
  looksGenerated,
  resolveLocatorBoundsInDocument,
  toSelectedElementMessage,
  validateLocatorInDocument,
} from './locator-selectors';

describe('locator selectors', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('uses an id as the preferred CSS selector', () => {
    document.body.innerHTML = `<button id="checkout">Checkout</button>`;

    const result = generateCssSelector(document.getElementById('checkout')!);

    expect(result).toBe('#checkout');
  });

  it('reports unique, multiple, empty, and invalid locator results safely', () => {
    document.body.innerHTML = `<button id="one"></button><button class="many"></button><button class="many"></button>`;

    expect(
      validateLocatorInDocument({
        requestId: '1',
        locatorType: 'CSS',
        locatorString: '#one',
      }),
    ).toMatchObject({ status: 'unique', matchCount: 1 });
    expect(
      validateLocatorInDocument({
        requestId: '2',
        locatorType: 'CSS',
        locatorString: '.many',
      }),
    ).toMatchObject({ status: 'multiple', matchCount: 2 });
    expect(
      validateLocatorInDocument({
        requestId: '3',
        locatorType: 'XPATH',
        locatorString: '//input',
      }),
    ).toMatchObject({ status: 'no-match', matchCount: 0 });
    expect(
      validateLocatorInDocument({
        requestId: '4',
        locatorType: 'CSS',
        locatorString: '[',
      }),
    ).toMatchObject({ status: 'invalid', matchCount: 0 });
  });

  it('scrolls to and resolves bounds for one matching locator', () => {
    document.body.innerHTML = `<button id="checkout">Checkout</button>`;
    const button = document.getElementById('checkout')!;
    const scrollIntoView = vi.fn();
    button.scrollIntoView = scrollIntoView;
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      top: 20,
      left: 30,
      width: 120,
      height: 40,
      right: 150,
      bottom: 60,
      x: 30,
      y: 20,
      toJSON: () => ({}),
    });

    const result = resolveLocatorBoundsInDocument({
      requestId: 'bounds',
      locatorType: 'CSS',
      locatorString: '#checkout',
      scrollIntoView: true,
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'center' });
    expect(result).toMatchObject({ left: 30, top: 20, width: 120, height: 40 });
  });

  it('uses stable attributes before structural selectors', () => {
    document.body.innerHTML = `<button data-testid="checkout button">Checkout</button>`;

    const result = generateCssSelector(document.querySelector('button')!);

    expect(result).toBe(`button[data-testid="checkout button"]`);
  });

  it('escapes quotes in attribute selectors', () => {
    document.body.innerHTML = `<button aria-label='Say "hello"'>Greeting</button>`;

    const result = generateCssSelector(document.querySelector('button')!);

    expect(result).toBe(`button[aria-label="Say \\"hello\\""]`);
  });

  it('uses stable classes and nth-of-type for structural selectors', () => {
    document.body.innerHTML = `
            <main>
                <button class="css-a1b2c3">Cancel</button>
                <button class="primary">Checkout</button>
            </main>
        `;

    const result = generateCssSelector(document.querySelectorAll('button')[1]);

    expect(result).toBe('main > button.primary:nth-of-type(2)');
  });

  it('uses an id as the preferred XPath', () => {
    document.body.innerHTML = `<button id="checkout">Checkout</button>`;

    const result = generateXPath(document.getElementById('checkout')!);

    expect(result).toBe(`//*[@id="checkout"]`);
  });

  it('builds XPath sibling indexes', () => {
    document.body.innerHTML = `<section><span>First</span><span>Second</span></section>`;

    const result = generateXPath(document.querySelectorAll('span')[1]);

    expect(result).toBe('/html[1]/body[1]/section[1]/span[2]');
  });

  it('creates a stored selected element', () => {
    document.body.innerHTML = `<button id="checkout">Checkout</button>`;

    const result = createSelectedElement(
      document.getElementById('checkout')!,
      '2026-05-19T20:00:00.000Z',
    );

    expect(result).toEqual({
      cssSelector: '#checkout',
      xpath: `//*[@id="checkout"]`,
      selectedAt: '2026-05-19T20:00:00.000Z',
    });
  });

  it('creates the runtime message from a stored element', () => {
    const result = toSelectedElementMessage({
      cssSelector: '#checkout',
      xpath: `//*[@id="checkout"]`,
      selectedAt: '2026-05-19T20:00:00.000Z',
    });

    expect(result).toEqual({
      type: 'TRAILS_ELEMENT_SELECTED',
      cssSelector: '#checkout',
      xpath: `//*[@id="checkout"]`,
    });
  });

  it('detects generated-looking classes', () => {
    expect(looksGenerated('css-a1b2c3')).toBe(true);
  });

  it('detects start inspector messages', () => {
    expect(isInspectorMessage({ type: 'TRAILS_START_INSPECTOR' })).toBe(true);
  });
});
