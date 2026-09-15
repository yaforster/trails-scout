import browser from 'webextension-polyfill';
import { fetchAllPages, putElement, testHealthEndpoint } from './api';
import { type AuthController, createAuthController } from './auth-controller';
import {
  elementTypes,
  minimumRefreshDelayMs,
  resourcePageSize,
  tokenRefreshSafetyMs,
} from './constants';
import { getPopupElements } from './dom';
import { createElementController } from './element-controller';
import { renderIcons } from './icons';
import { startLocatorPicker } from './locator';
import { createResourceController } from './resource-controller';
import { createSettingsMenu } from './settings-menu';
import { createTabController } from './tabs';
import { createTokenPanelController } from './token-panel-controller';
import { TokenSession } from './token-session';
import type { PopupSettings, SelectedLocator, StatusType } from './types';
import { isSelectedLocatorMessage, storageGet, trimTrailingSlash } from './utils';

const tokenSession = new TokenSession();
let authController: AuthController;

const {
  trailsServiceUrlInput,
  keycloakUrlInput,
  usernameInput,
  passwordInput,
  clientIdInput,
  clientSecretInput,
  applicationSelect,
  stageSelect,
  refreshResourcesButton,
  testTrailsConnectionButton,
  locatorTypeInput,
  locatorOutput,
  elementTypeInput,
  elementLabelInput,
  loginButton,
  showTokenButton,
  showTokenIcon,
  showTokenLabel,
  startInspectorButton,
  createElementButton,
  statusElement,
  tokenFeedback,
  tokenFeedbackIcon,
  tokenFeedbackText,
  tokenBox,
  tokenOutput,
  authTab,
  targetTab,
  elementTab,
  authPanel,
  targetPanel,
  elementPanel,
  settingsMenuContainer,
  settingsButton,
  settingsMenu,
  deleteTokenButton,
} = getPopupElements();

const settingsMenuController = createSettingsMenu(
  {
    settingsMenuContainer,
    settingsButton,
    settingsMenu,
    deleteTokenButton,
  },
  () => authController.deleteToken(),
);
const tokenPanelController = createTokenPanelController(
  {
    showTokenIcon,
    showTokenLabel,
    tokenFeedback,
    tokenFeedbackIcon,
    tokenFeedbackText,
    tokenBox,
    tokenOutput,
  },
  {
    getAccessToken: () => tokenSession.accessToken,
    getAccessTokenExpiresAt: () => tokenSession.accessTokenExpiresAt,
    renderIcons,
  },
);
const resourceController = createResourceController(
  {
    trailsServiceUrlInput,
    applicationSelect,
    stageSelect,
    refreshResourcesButton,
  },
  {
    pageSize: resourcePageSize,
    getAccessToken: () => tokenSession.accessToken,
    fetchAllPages,
    saveSettings,
    setStatus,
    refreshTabAvailability,
  },
);
const tabController = createTabController(
  {
    authTab,
    targetTab,
    elementTab,
    authPanel,
    targetPanel,
    elementPanel,
  },
  () => authController.hasValidAccessToken(),
  () =>
    authController.hasValidAccessToken() &&
    Boolean(
      resourceController.getSelectedApplicationId() && resourceController.getSelectedStageId(),
    ),
);
const elementController = createElementController(
  {
    trailsServiceUrlInput,
    locatorTypeInput,
    locatorOutput,
    elementTypeInput,
    elementLabelInput,
    createElementButton,
  },
  {
    getSelectedApplicationId: resourceController.getSelectedApplicationId,
    getSelectedStageId: resourceController.getSelectedStageId,
    getAccessToken: () => tokenSession.accessToken,
    putElement,
    saveSettings,
    setStatus,
  },
);
authController = createAuthController(
  {
    keycloakUrlInput,
    usernameInput,
    passwordInput,
    clientIdInput,
    clientSecretInput,
    loginButton,
  },
  {
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
    storageSet: (values) => browser.storage.local.set(values),
  },
);

initializePopup().catch((error) =>
  setStatus(`Could not initialize popup: ${String(error)}`, 'error'),
);

async function initializePopup(): Promise<void> {
  renderElementTypes();
  renderIcons();
  bindEvents();
  await restoreSettings();
  await restoreSelectedLocator();
  elementController.refreshSelectedLocator();
}

function renderElementTypes(): void {
  elementTypeInput.replaceChildren(
    ...elementTypes.map((type) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      return option;
    }),
  );
  elementTypeInput.value = 'INPUT';
}

function bindEvents(): void {
  loginButton.addEventListener('click', authController.login);
  showTokenButton.addEventListener('click', tokenPanelController.toggleVisibility);
  testTrailsConnectionButton.addEventListener('click', testTrailsConnection);
  refreshResourcesButton.addEventListener('click', resourceController.loadApplicationStages);
  startInspectorButton.addEventListener('click', () => {
    startLocatorPicker(startInspectorButton, setStatus).catch((error) => {
      setStatus(`Could not start locator picker: ${String(error)}`, 'error');
    });
  });
  createElementButton.addEventListener('click', elementController.createElement);
  applicationSelect.addEventListener('change', resourceController.selectApplicationResource);
  stageSelect.addEventListener('change', resourceController.selectStageResource);
  locatorTypeInput.addEventListener('change', elementController.refreshSelectedLocator);
  trailsServiceUrlInput.addEventListener('input', clearTrailsConnectionState);

  for (const input of [trailsServiceUrlInput, keycloakUrlInput, clientIdInput, clientSecretInput]) {
    input.addEventListener('change', saveSettings);
  }

  for (const input of [
    trailsServiceUrlInput,
    keycloakUrlInput,
    usernameInput,
    passwordInput,
    clientIdInput,
  ]) {
    input.addEventListener('input', refreshLoginState);
  }

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isSelectedLocatorMessage(message)) {
      return;
    }

    elementController.setSelectedLocator({
      cssSelector: message.cssSelector,
      xpath: message.xpath,
      selectedAt: new Date().toISOString(),
    });
    setStatus('Locator selected.', 'success');
  });
}

async function restoreSettings(): Promise<void> {
  const settings = await storageGet<PopupSettings>([
    'trailsServiceUrl',
    'keycloakUrl',
    'clientId',
    'clientSecret',
    'selectedApplicationId',
    'selectedStageId',
    'accessToken',
    'refreshToken',
    'accessTokenExpiresAt',
    'refreshTokenExpiresAt',
  ]);

  trailsServiceUrlInput.value = settings.trailsServiceUrl ?? trailsServiceUrlInput.value;
  keycloakUrlInput.value = settings.keycloakUrl ?? keycloakUrlInput.value;
  clientIdInput.value = settings.clientId ?? clientIdInput.value;
  clientSecretInput.value = settings.clientSecret ?? '';
  resourceController.restoreSelection(
    settings.selectedApplicationId ?? null,
    settings.selectedStageId ?? null,
  );
  tokenSession.restore(settings);

  refreshLoginState();
  refreshTabAvailability();

  if (authController.hasValidAccessToken()) {
    tokenPanelController.setExpiringStatus('Token available.', 'success');
    authController.scheduleTokenRefresh();
    await resourceController.loadApplicationStages();
    tabController.activate('target');
    return;
  }

  if (authController.canRefreshToken()) {
    tokenPanelController.setStatus('Refreshing token...', 'pending');
    await authController.refreshAccessToken('Token refreshed.');
    tabController.activate('target');
  }
}

async function restoreSelectedLocator(): Promise<void> {
  const result = await storageGet<{ lastSelectedElement?: SelectedLocator }>('lastSelectedElement');
  elementController.restoreSelectedLocator(result.lastSelectedElement ?? null);
}

async function saveSettings(): Promise<void> {
  await browser.storage.local.set({
    trailsServiceUrl: trailsServiceUrlInput.value.trim(),
    keycloakUrl: keycloakUrlInput.value.trim(),
    clientId: clientIdInput.value.trim(),
    clientSecret: clientSecretInput.value,
    selectedApplicationId: resourceController.getSelectedApplicationId(),
    selectedStageId: resourceController.getSelectedStageId(),
  });
}

async function testTrailsConnection(): Promise<void> {
  const trailsServiceUrl = trimTrailingSlash(trailsServiceUrlInput.value);
  if (!trailsServiceUrl) {
    setTrailsConnectionState('error');
    setStatus('Trails service URL is required.', 'error');
    return;
  }

  testTrailsConnectionButton.disabled = true;
  setStatus('Testing Trails service connection...');

  try {
    const response = await testHealthEndpoint(trailsServiceUrl, tokenSession.accessToken);

    if (!response.ok) {
      setTrailsConnectionState('error');
      setStatus(`Trails service responded with HTTP ${response.status}.`, 'error');
      return;
    }

    setTrailsConnectionState('success');
    setStatus('Trails service connection succeeded.', 'success');
    await saveSettings();
  } catch (error) {
    setTrailsConnectionState('error');
    setStatus('Trails service connection failed.', 'error');
  } finally {
    testTrailsConnectionButton.disabled = false;
  }
}

function clearTrailsConnectionState(): void {
  trailsServiceUrlInput.classList.remove('connection-success', 'connection-error');
}

function setTrailsConnectionState(type: 'success' | 'error'): void {
  trailsServiceUrlInput.classList.toggle('connection-success', type === 'success');
  trailsServiceUrlInput.classList.toggle('connection-error', type === 'error');
}

function refreshLoginState(): void {
  loginButton.disabled =
    !trailsServiceUrlInput.value.trim() ||
    !keycloakUrlInput.value.trim() ||
    !usernameInput.value.trim() ||
    !passwordInput.value ||
    !clientIdInput.value.trim();
}

function refreshTabAvailability(): void {
  tabController.refreshAvailability();
}

function setStatus(message: string, type: StatusType = 'idle'): void {
  statusElement.textContent = message;
  statusElement.className = `status ${type === 'idle' ? '' : type}`;
}

function fetchToken(keycloakUrl: string, body: URLSearchParams): Promise<Response> {
  return fetch(keycloakUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
}

export {};
