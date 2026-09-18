import { describe, expect, it } from 'vitest';
import html from './index.html?raw';

describe('popup HTML defaults', () => {
  it('ships empty connection values', () => {
    const document = new DOMParser().parseFromString(html, 'text/html');

    for (const id of ['keycloakUrl', 'trailsServiceUrl', 'clientId']) {
      expect(document.getElementById(id)?.getAttribute('value')).toBe('');
    }
  });

  it('ships accessible workflow and header controls', () => {
    const document = new DOMParser().parseFromString(html, 'text/html');

    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(document.querySelector('#authTab')?.textContent).toContain('Connect');
    expect(document.querySelector('#targetTab')?.textContent).toContain('Target');
    expect(document.querySelector('#elementTab')?.textContent).toContain('Capture');
    expect(document.querySelector('#targetTab small')?.textContent).toContain('Log in');
    expect(document.querySelector('#elementTab small')?.textContent).toContain('Select');
    expect(document.getElementById('themeToggle')?.getAttribute('aria-label')).toBe(
      'Switch to dark mode',
    );
    expect(document.getElementById('settingsButton')?.getAttribute('aria-label')).toBe(
      'Open settings',
    );
  });
});
