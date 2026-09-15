import { describe, expect, it } from 'vitest';
import html from './index.html?raw';

describe('popup HTML defaults', () => {
  it('ships empty connection values', () => {
    const document = new DOMParser().parseFromString(html, 'text/html');

    for (const id of ['keycloakUrl', 'trailsServiceUrl', 'clientId']) {
      expect(document.getElementById(id)?.getAttribute('value')).toBe('');
    }
  });
});
