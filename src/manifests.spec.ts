import { describe, expect, it } from 'vitest';
import chromeManifest from '../manifest.json';
import firefoxManifest from '../manifest.firefox.json';

describe('side-panel manifests', () => {
  it('opens Chrome action in a side panel', () => {
    expect(chromeManifest.action).not.toHaveProperty('default_popup');
    expect(chromeManifest.permissions).toContain('sidePanel');
    expect(chromeManifest.host_permissions).toEqual(['<all_urls>']);
    expect(chromeManifest.side_panel.default_path).toBe('src/popup/index.html');
    expect(chromeManifest.background.service_worker).toBe('src/background-chrome.ts');
  });

  it('uses Firefox sidebar action', () => {
    expect(firefoxManifest.action).not.toHaveProperty('default_popup');
    expect(firefoxManifest.permissions).not.toContain('sidePanel');
    expect(firefoxManifest.host_permissions).toEqual(['<all_urls>']);
    expect(firefoxManifest.side_panel.default_path).toBe('src/popup/index.html');
    expect(firefoxManifest.sidebar_action.default_panel).toBe('src/popup/index.html');
    expect(firefoxManifest.background.scripts).toEqual(['src/background-firefox.ts']);
  });
});
