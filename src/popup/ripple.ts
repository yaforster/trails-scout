export function enableButtonRipples(): void {
  document.querySelectorAll('button').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      addRipple(button, event.clientX, event.clientY);
    });
    button.addEventListener('keydown', (event) => {
      if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
        addRipple(button);
      }
    });
  });
}

function addRipple(button: HTMLButtonElement, clientX?: number, clientY?: number): void {
  if (button.disabled) {
    return;
  }

  const bounds = button.getBoundingClientRect();
  const size = Math.max(bounds.width, bounds.height) * 2;
  const ripple = document.createElement('span');
  ripple.className = 'button-ripple';
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${clientX === undefined ? bounds.width / 2 : clientX - bounds.left}px`;
  ripple.style.top = `${clientY === undefined ? bounds.height / 2 : clientY - bounds.top}px`;
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  button.append(ripple);
}
