import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createThemeController } from './theme-controller';

const storage = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock('webextension-polyfill', () => ({
  default: { storage: { local: storage } },
}));

describe('theme controller', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    storage.get.mockResolvedValue({});
    storage.set.mockResolvedValue(undefined);
  });

  it('defaults to light theme', async () => {
    const button = document.createElement('button');
    const renderIcons = vi.fn();
    const controller = createThemeController(button, renderIcons);

    await controller.restore();

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(renderIcons).toHaveBeenCalled();
  });

  it('restores persisted dark theme', async () => {
    storage.get.mockResolvedValue({ theme: 'dark' });
    const button = document.createElement('button');
    const controller = createThemeController(button, vi.fn());

    await controller.restore();

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Switch to light mode');
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
  });

  it('toggles and persists theme', async () => {
    const button = document.createElement('button');
    const controller = createThemeController(button, vi.fn());

    await controller.toggle();

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(storage.set).toHaveBeenCalledWith({ theme: 'dark' });
  });
});
