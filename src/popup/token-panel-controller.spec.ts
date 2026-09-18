import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTokenPanelController } from './token-panel-controller';

function createHarness() {
  document.body.innerHTML = `
        <i id="showTokenIcon"></i>
        <span id="showTokenLabel">Show token</span>
        <div id="tokenFeedback" title="old title"></div>
        <i id="tokenFeedbackIcon"></i>
        <span id="tokenFeedbackText"></span>
        <div id="tokenBox"></div>
        <textarea id="tokenOutput"></textarea>
    `;

  let accessToken: string | null = 'access-token';
  let accessTokenExpiresAt: number | null = 61_000;
  const renderIcons = vi.fn();
  const controller = createTokenPanelController(
    {
      showTokenIcon: document.getElementById('showTokenIcon') as HTMLElement,
      showTokenLabel: document.getElementById('showTokenLabel') as HTMLElement,
      tokenFeedback: document.getElementById('tokenFeedback') as HTMLElement,
      tokenFeedbackIcon: document.getElementById('tokenFeedbackIcon') as HTMLElement,
      tokenFeedbackText: document.getElementById('tokenFeedbackText') as HTMLElement,
      tokenBox: document.getElementById('tokenBox') as HTMLElement,
      tokenOutput: document.getElementById('tokenOutput') as HTMLTextAreaElement,
    },
    {
      getAccessToken: () => accessToken,
      getAccessTokenExpiresAt: () => accessTokenExpiresAt,
      renderIcons,
    },
  );

  return {
    controller,
    renderIcons,
    setAccessToken: (value: string | null) => {
      accessToken = value;
    },
    setAccessTokenExpiresAt: (value: number | null) => {
      accessTokenExpiresAt = value;
    },
    showTokenIcon: document.getElementById('showTokenIcon') as HTMLElement,
    showTokenLabel: document.getElementById('showTokenLabel') as HTMLElement,
    tokenBox: document.getElementById('tokenBox') as HTMLElement,
    tokenFeedback: document.getElementById('tokenFeedback') as HTMLElement,
    tokenFeedbackIcon: document.getElementById('tokenFeedbackIcon') as HTMLElement,
    tokenFeedbackText: document.getElementById('tokenFeedbackText') as HTMLElement,
    tokenOutput: document.getElementById('tokenOutput') as HTMLTextAreaElement,
  };
}

describe('token panel controller', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('toggles token visibility and updates the icon label', () => {
    const { controller, showTokenIcon, showTokenLabel, tokenBox, tokenOutput } = createHarness();

    controller.toggleVisibility();

    expect(tokenBox.style.display).toBe('block');
    expect(tokenOutput.value).toBe('access-token');
    expect(showTokenIcon.dataset.lucide).toBe('eye-off');
    expect(showTokenLabel.textContent).toBe('Hide token');

    controller.toggleVisibility();

    expect(tokenBox.style.display).toBe('none');
    expect(tokenOutput.value).toBe('');
    expect(showTokenIcon.dataset.lucide).toBe('eye');
    expect(showTokenLabel.textContent).toBe('Show token');
  });

  it('shows an error instead of opening the token box when no token exists', () => {
    const { controller, setAccessToken, tokenBox, tokenFeedbackText } = createHarness();
    setAccessToken(null);

    controller.toggleVisibility();

    expect(tokenBox.style.display).toBe('');
    expect(tokenFeedbackText.textContent).toBe('No token available.');
  });

  it('syncs a visible token output after token refresh', () => {
    const { controller, setAccessToken, tokenOutput } = createHarness();
    controller.setVisibility(true);
    setAccessToken('refreshed-token');

    controller.syncVisibleToken();

    expect(tokenOutput.value).toBe('refreshed-token');
  });

  it('sets a plain token status and clears the previous title', () => {
    const { controller, tokenFeedback, tokenFeedbackIcon, tokenFeedbackText } = createHarness();

    controller.setStatus('Fetching token...', 'pending');

    expect(tokenFeedback.className).toBe('token-feedback visible pending');
    expect(tokenFeedback.title).toBe('');
    expect(tokenFeedbackIcon.dataset.lucide).toBe('loader-circle');
    expect(tokenFeedbackText.textContent).toBe('Fetching token...');
  });

  it('shows a countdown title for expiring token status', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const { controller, tokenFeedback, tokenFeedbackIcon, tokenFeedbackText } = createHarness();

    controller.setExpiringStatus('Connected', 'success');

    expect(tokenFeedback.className).toBe('token-feedback visible success');
    expect(tokenFeedback.title).toBe('Expires in 1m 00s.');
    expect(tokenFeedbackIcon.dataset.lucide).toBe('circle-check');
    expect(tokenFeedbackText.textContent).toBe('Connected');
    controller.clearCountdown();
  });

  it('marks expiring token status as an error after expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000);
    const { controller, setAccessTokenExpiresAt, tokenFeedback } = createHarness();
    setAccessTokenExpiresAt(1_000);

    controller.setExpiringStatus('Connected', 'success');

    expect(tokenFeedback.className).toBe('token-feedback visible error');
    expect(tokenFeedback.title).toBe('Token expired.');
    controller.clearCountdown();
  });
});
