import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthController } from './auth-controller';
import type { ResourceController } from './resource-controller';
import type { TabController } from './tabs';
import type { TokenPanelController } from './token-panel-controller';
import { TokenSession } from './token-session';

vi.mock('webextension-polyfill', () => ({ default: {} }));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createHarness() {
  document.body.innerHTML = `
        <input id="keycloakUrl" value=" https://keycloak.local/token " />
        <input id="username" value=" alice " />
        <input id="password" value="secret" />
        <input id="clientId" value=" trails-demo " />
        <input id="clientSecret" value="client-secret" />
        <button id="loginButton"></button>
    `;

  const tokenSession = new TokenSession();
  const tokenPanelController: TokenPanelController = {
    clearCountdown: vi.fn(),
    clearOutput: vi.fn(),
    setExpiringStatus: vi.fn(),
    setStatus: vi.fn(),
    setVisibility: vi.fn(),
    syncVisibleToken: vi.fn(),
    toggleVisibility: vi.fn(),
  };
  const resourceController: Pick<
    ResourceController,
    'clearCache' | 'loadApplicationStages' | 'showTokenRequired'
  > = {
    clearCache: vi.fn(),
    loadApplicationStages: vi.fn().mockResolvedValue(undefined),
    showTokenRequired: vi.fn(),
  };
  const settingsMenuController = {
    setOpen: vi.fn(),
  };
  const tabController: Pick<TabController, 'activate'> = {
    activate: vi.fn(),
  };
  const fetchToken = vi.fn().mockResolvedValue(
    jsonResponse({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 60,
      refresh_expires_in: 120,
    }),
  );
  const refreshLoginState = vi.fn();
  const refreshTabAvailability = vi.fn();
  const saveSettings = vi.fn().mockResolvedValue(undefined);
  const setStatus = vi.fn();
  const storageSet = vi.fn().mockResolvedValue(undefined);

  const controller = createAuthController(
    {
      keycloakUrlInput: document.getElementById('keycloakUrl') as HTMLInputElement,
      usernameInput: document.getElementById('username') as HTMLInputElement,
      passwordInput: document.getElementById('password') as HTMLInputElement,
      clientIdInput: document.getElementById('clientId') as HTMLInputElement,
      clientSecretInput: document.getElementById('clientSecret') as HTMLInputElement,
      loginButton: document.getElementById('loginButton') as HTMLButtonElement,
    },
    {
      minimumRefreshDelayMs: 100,
      tokenRefreshSafetyMs: 10,
      tokenSession,
      tokenPanelController,
      resourceController,
      settingsMenuController,
      tabController,
      fetchToken,
      refreshLoginState,
      refreshTabAvailability,
      saveSettings,
      setStatus,
      storageSet,
    },
  );

  return {
    controller,
    fetchToken,
    loginButton: document.getElementById('loginButton') as HTMLButtonElement,
    refreshLoginState,
    refreshTabAvailability,
    resourceController,
    saveSettings,
    setStatus,
    settingsMenuController,
    storageSet,
    tabController,
    tokenPanelController,
    tokenSession,
  };
}

describe('auth controller', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects login when required connection fields are incomplete', async () => {
    const { controller, fetchToken, loginButton, refreshLoginState, tokenPanelController } =
      createHarness();
    refreshLoginState.mockImplementation(() => {
      loginButton.disabled = true;
    });

    await controller.login();

    expect(fetchToken).not.toHaveBeenCalled();
    expect(tokenPanelController.setStatus).toHaveBeenCalledWith(
      'Complete the required connection fields.',
      'error',
    );
  });

  it('logs in, stores token state, loads resources, and activates the target tab', async () => {
    const {
      controller,
      fetchToken,
      refreshTabAvailability,
      resourceController,
      saveSettings,
      storageSet,
      tabController,
      tokenPanelController,
      tokenSession,
    } = createHarness();

    await controller.login();

    expect(fetchToken).toHaveBeenCalledWith(
      'https://keycloak.local/token',
      expect.any(URLSearchParams),
    );
    expect(Object.fromEntries(fetchToken.mock.calls[0][1])).toEqual({
      grant_type: 'password',
      client_id: 'trails-demo',
      username: 'alice',
      password: 'secret',
      client_secret: 'client-secret',
    });
    expect(storageSet).toHaveBeenNthCalledWith(1, {
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
    });
    expect(storageSet).toHaveBeenNthCalledWith(2, {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: 61_000,
      refreshTokenExpiresAt: 121_000,
    });
    expect(tokenSession.accessToken).toBe('access-token');
    expect(tokenPanelController.setStatus).toHaveBeenCalledWith('Fetching token...', 'pending');
    expect(tokenPanelController.setExpiringStatus).toHaveBeenCalledWith(
      'Token fetched.',
      'success',
    );
    expect(saveSettings).toHaveBeenCalled();
    expect(resourceController.loadApplicationStages).toHaveBeenCalled();
    expect(refreshTabAvailability).toHaveBeenCalled();
    expect(tabController.activate).toHaveBeenCalledWith('target');
  });

  it('shows server-provided login errors', async () => {
    const { controller, fetchToken, resourceController, saveSettings, tokenPanelController } =
      createHarness();
    fetchToken.mockResolvedValueOnce(
      jsonResponse({ error_description: 'Invalid credentials.' }, 401),
    );

    await controller.login();

    expect(tokenPanelController.setStatus).toHaveBeenLastCalledWith(
      'Invalid credentials.',
      'error',
    );
    expect(saveSettings).not.toHaveBeenCalled();
    expect(resourceController.loadApplicationStages).not.toHaveBeenCalled();
  });

  it('refreshes an existing refresh token', async () => {
    const {
      controller,
      fetchToken,
      resourceController,
      storageSet,
      tokenPanelController,
      tokenSession,
    } = createHarness();
    tokenSession.restore({
      refreshToken: 'existing-refresh',
      refreshTokenExpiresAt: 30_000,
    });

    await controller.refreshAccessToken('Token refreshed.');

    expect(Object.fromEntries(fetchToken.mock.calls[0][1])).toEqual({
      grant_type: 'refresh_token',
      client_id: 'trails-demo',
      refresh_token: 'existing-refresh',
      client_secret: 'client-secret',
    });
    expect(storageSet).toHaveBeenCalledWith({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: 61_000,
      refreshTokenExpiresAt: 121_000,
    });
    expect(tokenPanelController.setExpiringStatus).toHaveBeenCalledWith(
      'Token refreshed.',
      'success',
    );
    expect(resourceController.loadApplicationStages).toHaveBeenCalled();
  });

  it('does not refresh when the refresh token is expired', async () => {
    const { controller, fetchToken, tokenPanelController, tokenSession } = createHarness();
    tokenSession.restore({
      refreshToken: 'expired-refresh',
      refreshTokenExpiresAt: 500,
    });

    await controller.refreshAccessToken('Token refreshed.');

    expect(fetchToken).not.toHaveBeenCalled();
    expect(tokenPanelController.setStatus).toHaveBeenCalledWith('Refresh expired.', 'error');
  });

  it('schedules a retry when refresh token fetching fails', async () => {
    const { controller, fetchToken, tokenPanelController, tokenSession } = createHarness();
    tokenSession.restore({
      accessTokenExpiresAt: 5_000,
      refreshToken: 'refresh-token',
      refreshTokenExpiresAt: 30_000,
    });
    fetchToken.mockRejectedValueOnce(new Error('Network failed.'));

    await controller.refreshAccessToken('Token refreshed.');

    expect(tokenPanelController.setExpiringStatus).toHaveBeenCalledWith(
      'Refresh retry scheduled.',
      'error',
    );
    expect(fetchToken).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    await Promise.resolve();

    expect(tokenPanelController.setStatus).toHaveBeenCalledWith('Refreshing token...', 'pending');
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it('deletes stored token state and returns to auth', async () => {
    const {
      controller,
      refreshTabAvailability,
      resourceController,
      setStatus,
      settingsMenuController,
      storageSet,
      tabController,
      tokenPanelController,
      tokenSession,
    } = createHarness();
    tokenSession.restore({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: 10_000,
      refreshTokenExpiresAt: 20_000,
    });

    await controller.deleteToken();

    expect(settingsMenuController.setOpen).toHaveBeenCalledWith(false);
    expect(resourceController.clearCache).toHaveBeenCalled();
    expect(resourceController.showTokenRequired).toHaveBeenCalled();
    expect(storageSet).toHaveBeenCalledWith({
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
    });
    expect(tokenPanelController.clearCountdown).toHaveBeenCalled();
    expect(tokenPanelController.clearOutput).toHaveBeenCalled();
    expect(tokenPanelController.setVisibility).toHaveBeenCalledWith(false);
    expect(tokenPanelController.setStatus).toHaveBeenCalledWith('Token deleted.', 'success');
    expect(refreshTabAvailability).toHaveBeenCalled();
    expect(tabController.activate).toHaveBeenCalledWith('auth');
    expect(setStatus).toHaveBeenCalledWith('Stored token deleted.', 'success');
  });

  it('reports whether access and refresh tokens are valid', () => {
    const { controller, tokenSession } = createHarness();
    tokenSession.restore({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: 2_000,
      refreshTokenExpiresAt: 3_000,
    });

    expect(controller.hasValidAccessToken()).toBe(true);
    expect(controller.canRefreshToken()).toBe(true);

    vi.setSystemTime(3_000);

    expect(controller.hasValidAccessToken()).toBe(false);
    expect(controller.canRefreshToken()).toBe(false);
  });
});
