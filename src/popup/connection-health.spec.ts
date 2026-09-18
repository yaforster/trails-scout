import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testHealthEndpoint } from './api';
import { createConnectionHealth } from './connection-health';

vi.mock('./api', () => ({ testHealthEndpoint: vi.fn() }));
vi.mock('webextension-polyfill', () => ({ default: {} }));

describe('connection health', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="url" value="https://trails.local/" />
      <button id="test"></button>
      <div id="feedback"></div>
    `;
  });

  it('shows pending and success beside URL, then saves settings', async () => {
    vi.mocked(testHealthEndpoint).mockResolvedValue(new Response(null, { status: 200 }));
    const setStatus = vi.fn();
    const saveSettings = vi.fn().mockResolvedValue(undefined);
    const controller = createConnectionHealth(
      {
        trailsServiceUrlInput: document.getElementById('url') as HTMLInputElement,
        testTrailsConnectionButton: document.getElementById('test') as HTMLButtonElement,
        trailsConnectionFeedback: document.getElementById('feedback') as HTMLDivElement,
      },
      { getAccessToken: () => null, saveSettings, setStatus },
    );

    const request = controller.test();
    expect(document.getElementById('feedback')?.textContent).toBe('Testing connection...');
    await request;

    expect(document.getElementById('feedback')?.textContent).toBe('Connection succeeded.');
    expect(saveSettings).toHaveBeenCalledOnce();
  });
});
