import browser from 'webextension-polyfill';
import type { Theme } from './types';

export interface ThemeController {
  restore(): Promise<void>;
  toggle(): Promise<void>;
}

export function createThemeController(
  toggleButton: HTMLButtonElement,
  renderIcons: () => void,
): ThemeController {
  let theme: Theme = 'light';

  function apply(nextTheme: Theme): void {
    theme = nextTheme;
    const icon = toggleButton.querySelector<HTMLElement>('.icon');
    if (icon) {
      icon.dataset.lucide = theme === 'dark' ? 'sun' : 'moon';
    }
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('app-dark', theme === 'dark');
    toggleButton.setAttribute('aria-pressed', String(theme === 'dark'));
    toggleButton.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
    );
    toggleButton.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    renderIcons();
  }

  async function restore(): Promise<void> {
    const stored = await browser.storage.local.get('theme');
    apply(stored.theme === 'dark' ? 'dark' : 'light');
  }

  async function toggle(): Promise<void> {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    apply(nextTheme);
    await browser.storage.local.set({ theme: nextTheme });
  }

  apply('light');
  toggleButton.addEventListener('click', () => {
    void toggle();
  });

  return { restore, toggle };
}
