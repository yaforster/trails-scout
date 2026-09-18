import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enableButtonRipples } from './ripple';

describe('button ripples', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="button">Click</button>';
  });

  it('starts a ripple at the pointer position', () => {
    const button = document.getElementById('button') as HTMLButtonElement;
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
      width: 80,
      height: 40,
    } as DOMRect);
    enableButtonRipples();

    button.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, clientX: 30, clientY: 45 }),
    );

    const ripple = button.querySelector('.button-ripple') as HTMLSpanElement;
    expect(ripple.style.width).toBe('160px');
    expect(ripple.style.left).toBe('20px');
    expect(ripple.style.top).toBe('25px');
  });

  it('does not add ripples to disabled buttons', () => {
    const button = document.getElementById('button') as HTMLButtonElement;
    button.disabled = true;
    enableButtonRipples();

    button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

    expect(button.querySelector('.button-ripple')).toBeNull();
  });

  it('removes the ripple after its animation', () => {
    const button = document.getElementById('button') as HTMLButtonElement;
    enableButtonRipples();
    button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));

    const ripple = button.querySelector('.button-ripple') as HTMLSpanElement;
    ripple.dispatchEvent(new Event('animationend'));

    expect(button.querySelector('.button-ripple')).toBeNull();
  });
});
