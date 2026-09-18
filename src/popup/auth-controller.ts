import type { ResourceController } from './resource-controller';
import type { TabController } from './tabs';
import type { TokenPanelController } from './token-panel-controller';
import {
  buildPasswordTokenRequestBody,
  buildRefreshTokenRequestBody,
  TokenSession,
} from './token-session';
import type { KeycloakTokenResponse, StatusType } from './types';
import { readErrorMessage } from './utils';

interface AuthControllerElements {
  keycloakUrlInput: HTMLInputElement;
  usernameInput: HTMLInputElement;
  passwordInput: HTMLInputElement;
  clientIdInput: HTMLInputElement;
  clientSecretInput: HTMLInputElement;
  loginButton: HTMLButtonElement;
  loginFeedback: HTMLElement;
}

interface AuthControllerDependencies {
  minimumRefreshDelayMs: number;
  tokenRefreshSafetyMs: number;
  tokenSession: TokenSession;
  tokenPanelController: TokenPanelController;
  resourceController: Pick<
    ResourceController,
    'clearCache' | 'loadApplicationStages' | 'showTokenRequired'
  >;
  settingsMenuController: { setOpen(open: boolean): void };
  tabController: Pick<TabController, 'activate'>;
  fetchToken(keycloakUrl: string, body: URLSearchParams): Promise<Response>;
  refreshLoginState(): void;
  refreshTabAvailability(): void;
  saveSettings(): Promise<void>;
  setStatus(message: string, type?: StatusType): void;
  storageSet(values: Record<string, unknown>): Promise<void>;
}

export interface AuthController {
  applyTokenResponse(result: KeycloakTokenResponse, successMessage: string): Promise<void>;
  canRefreshToken(): boolean;
  clearTokenRefreshSchedule(): void;
  deleteToken(): Promise<void>;
  hasValidAccessToken(): boolean;
  login(): Promise<void>;
  refreshAccessToken(successMessage: string): Promise<void>;
  scheduleTokenRefresh(delayOverrideMs?: number): void;
}

export function createAuthController(
  elements: AuthControllerElements,
  dependencies: AuthControllerDependencies,
): AuthController {
  let tokenRefreshTimeoutId: number | null = null;

  const {
    keycloakUrlInput,
    usernameInput,
    passwordInput,
    clientIdInput,
    clientSecretInput,
    loginButton,
    loginFeedback,
  } = elements;

  const {
    minimumRefreshDelayMs,
    tokenRefreshSafetyMs,
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
  } = dependencies;

  [keycloakUrlInput, usernameInput, passwordInput, clientIdInput, clientSecretInput].forEach(
    (input) => input.addEventListener('input', clearLoginError),
  );

  async function login(): Promise<void> {
    refreshLoginState();
    clearLoginError();
    if (loginButton.disabled) {
      const message = 'Complete the required connection fields.';
      setLoginError(message);
      tokenPanelController.setStatus(message, 'error');
      return;
    }

    clearTokenRefreshSchedule();
    tokenSession.clear();
    await storageSet(tokenSession.snapshot());
    tokenPanelController.clearOutput();
    tokenPanelController.setVisibility(false);
    refreshTabAvailability();

    const keycloakUrl = keycloakUrlInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const clientId = clientIdInput.value.trim();
    const clientSecret = clientSecretInput.value;

    tokenPanelController.setStatus('Fetching token...', 'pending');

    try {
      const response = await fetchToken(
        keycloakUrl,
        buildPasswordTokenRequestBody({ clientId, username, password, clientSecret }),
      );
      const result = (await response.json()) as KeycloakTokenResponse;
      if (!response.ok) {
        const message = readErrorMessage(result, 'Login failed.');
        setLoginError(message);
        tokenPanelController.setStatus(message, 'error');
        return;
      }

      await applyTokenResponse(result, 'Connected');
      await saveSettings();
      await resourceController.loadApplicationStages();
      tabController.activate('target');
    } catch {
      const message =
        'Could not reach Keycloak. Check the token endpoint URL and network connection.';
      setLoginError(message, true);
      tokenPanelController.setStatus('Token fetch failed.', 'error');
    }
  }

  function clearLoginError(): void {
    keycloakUrlInput.classList.remove('connection-error');
    keycloakUrlInput.removeAttribute('aria-invalid');
    loginFeedback.className = 'field-feedback';
    loginFeedback.textContent = '';
  }

  function setLoginError(message: string, invalidKeycloakUrl = false): void {
    loginFeedback.className = 'field-feedback error';
    loginFeedback.textContent = message;
    keycloakUrlInput.classList.toggle('connection-error', invalidKeycloakUrl);
    if (invalidKeycloakUrl) {
      keycloakUrlInput.setAttribute('aria-invalid', 'true');
    }
  }

  async function deleteToken(): Promise<void> {
    settingsMenuController.setOpen(false);
    clearTokenRefreshSchedule();
    tokenPanelController.clearCountdown();
    tokenSession.clear();
    resourceController.clearCache();

    await storageSet(tokenSession.snapshot());

    tokenPanelController.clearOutput();
    tokenPanelController.setVisibility(false);
    resourceController.showTokenRequired();
    tokenPanelController.setStatus('Unavailable', 'error');
    refreshTabAvailability();
    tabController.activate('auth');
    setStatus('Stored token deleted.', 'success');
  }

  async function refreshAccessToken(successMessage: string): Promise<void> {
    const refreshToken = tokenSession.refreshToken;
    if (!refreshToken || !canRefreshToken()) {
      clearTokenRefreshSchedule();
      tokenPanelController.setStatus('Refresh expired.', 'error');
      return;
    }

    const keycloakUrl = keycloakUrlInput.value.trim();
    const clientId = clientIdInput.value.trim();
    const clientSecret = clientSecretInput.value;
    if (!keycloakUrl || !clientId) {
      tokenPanelController.setStatus('Auth config missing.', 'error');
      return;
    }

    try {
      const response = await fetchToken(
        keycloakUrl,
        buildRefreshTokenRequestBody({ clientId, refreshToken, clientSecret }),
      );
      const result = (await response.json()) as KeycloakTokenResponse;
      if (!response.ok) {
        clearTokenRefreshSchedule();
        tokenPanelController.setStatus(readErrorMessage(result, 'Refresh failed.'), 'error');
        return;
      }

      await applyTokenResponse(result, successMessage);
      await resourceController.loadApplicationStages();
    } catch (error) {
      scheduleTokenRefresh(minimumRefreshDelayMs);
      tokenPanelController.setExpiringStatus('Refresh retry scheduled.', 'error');
    }
  }

  async function applyTokenResponse(
    result: KeycloakTokenResponse,
    successMessage: string,
  ): Promise<void> {
    const snapshot = tokenSession.applyResponse(result);
    await storageSet(snapshot);

    tokenPanelController.syncVisibleToken();
    tokenPanelController.setExpiringStatus(successMessage, 'success');
    scheduleTokenRefresh();
    refreshTabAvailability();
  }

  function hasValidAccessToken(): boolean {
    return tokenSession.hasValidAccessToken();
  }

  function canRefreshToken(): boolean {
    return tokenSession.canRefreshToken();
  }

  function scheduleTokenRefresh(delayOverrideMs?: number): void {
    clearTokenRefreshSchedule();

    if (!tokenSession.accessTokenExpiresAt || !canRefreshToken()) {
      return;
    }

    const refreshDelayMs =
      delayOverrideMs ??
      Math.max(
        tokenSession.accessTokenExpiresAt - Date.now() - tokenRefreshSafetyMs,
        minimumRefreshDelayMs,
      );
    tokenRefreshTimeoutId = window.setTimeout(() => {
      tokenPanelController.setStatus('Refreshing token...', 'pending');
      refreshAccessToken('Connected').catch((error) => {
        tokenPanelController.setStatus(`Refresh failed: ${String(error)}`, 'error');
      });
    }, refreshDelayMs);
  }

  function clearTokenRefreshSchedule(): void {
    if (tokenRefreshTimeoutId !== null) {
      window.clearTimeout(tokenRefreshTimeoutId);
      tokenRefreshTimeoutId = null;
    }
  }

  return {
    applyTokenResponse,
    canRefreshToken,
    clearTokenRefreshSchedule,
    deleteToken,
    hasValidAccessToken,
    login,
    refreshAccessToken,
    scheduleTokenRefresh,
  };
}
