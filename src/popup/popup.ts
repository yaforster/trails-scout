import browser from 'webextension-polyfill';
import { fetchAllPages, fetchAllPagesWithLinks, putElement } from './api';
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
import { createConnectionHealth } from './connection-health';
import { createConnectionSettings } from './connection-settings';
import { createResourceController } from './resource-controller';
import { createSettingsMenu } from './settings-menu';
import { createTabController } from './tabs';
import { createTokenPanelController } from './token-panel-controller';
import { TokenSession } from './token-session';
import { createThemeController } from './theme-controller';
import type { SelectedLocator } from './types';
import { createStatusView } from './status-view';
import { isSelectedLocatorMessage, storageGet } from './utils';

export function startPopup(): void {
  const tokenSession = new TokenSession();
  let authController: AuthController;
  let connectionSettings: ReturnType<typeof createConnectionSettings>;

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
    trailsConnectionFeedback,
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
    themeToggle,
  } = getPopupElements();
  const setStatus = createStatusView(statusElement);
  const themeController = createThemeController(themeToggle, renderIcons);

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
      fetchAllPagesWithLinks,
      saveSettings,
      setStatus,
      refreshTabAvailability,
    },
  );
  connectionSettings = createConnectionSettings(
    { trailsServiceUrlInput, keycloakUrlInput, clientIdInput, clientSecretInput },
    {
      getSelectedApplicationId: resourceController.getSelectedApplicationId,
      getSelectedStageId: resourceController.getSelectedStageId,
      getCreateElementHref: resourceController.getCreateElementHref,
      restoreSelection: resourceController.restoreSelection,
      restoreToken: (settings) => tokenSession.restore(settings),
    },
  );
  const connectionHealth = createConnectionHealth(
    { trailsServiceUrlInput, testTrailsConnectionButton, trailsConnectionFeedback },
    {
      getAccessToken: () => tokenSession.accessToken,
      saveSettings,
      setStatus,
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
    bindEvents();
    await themeController.restore();
    renderIcons();
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
    testTrailsConnectionButton.addEventListener('click', connectionHealth.test);
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
    trailsServiceUrlInput.addEventListener('input', connectionHealth.clear);

    for (const input of [
      trailsServiceUrlInput,
      keycloakUrlInput,
      clientIdInput,
      clientSecretInput,
    ]) {
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
    const settings = await connectionSettings.restore();

    refreshLoginState();
    refreshTabAvailability();

    if (authController.hasValidAccessToken()) {
      tokenPanelController.setExpiringStatus('Connected', 'success');
      authController.scheduleTokenRefresh();
      await resourceController.loadApplicationStages();
      tabController.activate('target');
      return;
    }

    if (authController.canRefreshToken()) {
      tokenPanelController.setStatus('Refreshing token...', 'pending');
      await authController.refreshAccessToken('Connected');
      tabController.activate('target');
    }
  }

  async function restoreSelectedLocator(): Promise<void> {
    const result = await storageGet<{ lastSelectedElement?: SelectedLocator }>(
      'lastSelectedElement',
    );
    elementController.restoreSelectedLocator(result.lastSelectedElement ?? null);
  }

  async function saveSettings(): Promise<void> {
    await connectionSettings.save();
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

  function fetchToken(keycloakUrl: string, body: URLSearchParams): Promise<Response> {
    return fetch(keycloakUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
  }
}
