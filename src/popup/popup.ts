import browser from 'webextension-polyfill';
import { fetchAllPages, fetchAllPagesWithLinks, putElement, uploadElementScreenshot } from './api';
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
import { getLocatorBounds, startLocatorPicker, validateLocator } from './locator';
import { createConnectionHealth } from './connection-health';
import { createConnectionSettings } from './connection-settings';
import { createResourceController } from './resource-controller';
import { createScreenshotController } from './screenshot-controller';
import { createQueueController } from './queue-controller';
import { createSettingsMenu } from './settings-menu';
import { createTabController } from './tabs';
import { createTokenPanelController } from './token-panel-controller';
import { TokenSession } from './token-session';
import { createThemeController } from './theme-controller';
import type { SelectedLocator, TabId } from './types';
import { createStatusView } from './status-view';
import { isLocatorCancelledMessage, isSelectedLocatorMessage, storageGet } from './utils';

export function startPopup(): void {
  const tokenSession = new TokenSession();
  let authController: AuthController;
  let connectionSettings: ReturnType<typeof createConnectionSettings>;
  let elementController: ReturnType<typeof createElementController>;
  let screenshotController: ReturnType<typeof createScreenshotController>;
  let queueController: ReturnType<typeof createQueueController>;

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
    targetSummary,
    testTrailsConnectionButton,
    trailsConnectionFeedback,
    locatorTypeInput,
    locatorOutput,
    editLocatorButton,
    validateLocatorButton,
    locatorValidationFeedback,
    locatorCssOutput,
    locatorXpathOutput,
    locatorCssFeedback,
    locatorXpathFeedback,
    copyLocatorButton,
    copyLocatorFeedback,
    addToQueueButton,
    createQueueButton,
    clearQueueButton,
    queueCount,
    queueList,
    captureScreenshotButton,
    replaceScreenshotButton,
    removeScreenshotButton,
    retryScreenshotButton,
    screenshotPreview,
    screenshotDetails,
    screenshotFeedback,
    elementTargetSummary,
    captureBlocker,
    elementTypeInput,
    elementLabelInput,
    loginButton,
    loginFeedback,
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
  screenshotController = createScreenshotController(
    {
      captureButton: captureScreenshotButton,
      replaceButton: replaceScreenshotButton,
      removeButton: removeScreenshotButton,
      preview: screenshotPreview,
      details: screenshotDetails,
      feedback: screenshotFeedback,
    },
    setStatus,
    {
      getLocator: () => elementController?.getCurrentLocator() ?? null,
      getLocatorBounds,
    },
  );

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
      targetSummary,
      elementTargetSummary,
    },
    {
      pageSize: resourcePageSize,
      getAccessToken: () => tokenSession.accessToken,
      fetchAllPages,
      fetchAllPagesWithLinks,
      saveSettings,
      setStatus,
      refreshTabAvailability,
      beforeTargetChange: () => queueController?.confirmTargetChange() ?? true,
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
    (tabId) => {
      void browser.storage.local.set({ lastPopupTab: tabId });
    },
  );
  elementController = createElementController(
    {
      trailsServiceUrlInput,
      locatorTypeInput,
      locatorOutput,
      locatorValidationFeedback,
      locatorCssFeedback,
      locatorXpathFeedback,
      editLocatorButton,
      validateLocatorButton,
      locatorCssOutput,
      locatorXpathOutput,
      copyLocatorFeedback,
      retryScreenshotButton,
      elementTypeInput,
      elementLabelInput,
      createElementButton,
    },
    {
      getSelectedApplicationId: resourceController.getSelectedApplicationId,
      getSelectedStageId: resourceController.getSelectedStageId,
      getCreateElementHref: resourceController.getCreateElementHref,
      getAccessToken: () => tokenSession.accessToken,
      putElement,
      validateLocator,
      getExistingElements: resourceController.getExistingElements,
      getScreenshot: () => screenshotController.getState()?.blob ?? null,
      clearScreenshot: screenshotController.clear,
      uploadScreenshot: uploadElementScreenshot,
      saveSettings,
      setStatus,
    },
  );
  queueController = createQueueController(
    {
      addButton: addToQueueButton,
      createButton: createQueueButton,
      clearButton: clearQueueButton,
      count: queueCount,
      list: queueList,
    },
    {
      getCandidate: () =>
        elementController.getQueueCandidate(resourceController.getTargetContext()),
      createElement: elementController.createQueuedElement,
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
      loginFeedback,
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
    await restorePopupTab();
    await restoreSettings();
    await restoreSelectedLocator();
    elementController.refreshSelectedLocator();
    elementController.refreshCreateAvailability();
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
    copyLocatorButton.addEventListener('click', elementController.copyLocator);
    captureScreenshotButton.addEventListener('click', screenshotController.capture);
    replaceScreenshotButton.addEventListener('click', screenshotController.replace);
    removeScreenshotButton.addEventListener('click', screenshotController.remove);
    retryScreenshotButton.addEventListener('click', elementController.retryScreenshotUpload);
    editLocatorButton.addEventListener('click', elementController.editLocator);
    validateLocatorButton.addEventListener('click', elementController.validateCurrentLocator);
    locatorOutput.addEventListener('input', elementController.handleLocatorInput);
    createElementButton.addEventListener('click', elementController.createElement);
    applicationSelect.addEventListener('change', resourceController.selectApplicationResource);
    stageSelect.addEventListener('change', resourceController.selectStageResource);
    locatorTypeInput.addEventListener('change', elementController.refreshSelectedLocator);
    locatorTypeInput.addEventListener('change', elementController.refreshCreateAvailability);
    elementLabelInput.addEventListener('input', elementController.refreshCreateAvailability);
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
      if (isLocatorCancelledMessage(message)) {
        setStatus('Picker cancelled.');
        startInspectorButton.focus();
        return;
      }
      if (!isSelectedLocatorMessage(message)) {
        return;
      }

      elementController.setSelectedLocator({
        cssSelector: message.cssSelector,
        xpath: message.xpath,
        selectedAt: new Date().toISOString(),
      });
      setStatus('Locator selected.', 'success');
      startInspectorButton.focus();
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
      await restorePopupTab();
      return;
    }

    if (authController.canRefreshToken()) {
      tokenPanelController.setStatus('Refreshing token...', 'pending');
      await authController.refreshAccessToken('Connected');
      await restorePopupTab();
    }
  }

  async function restorePopupTab(): Promise<void> {
    const result = await storageGet<{ lastPopupTab?: TabId }>('lastPopupTab');
    tabController.restore(result.lastPopupTab ?? 'target');
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
    elementController?.refreshCreateAvailability();
    captureBlocker.textContent = tokenSession.accessToken
      ? resourceController.getSelectedApplicationId() && resourceController.getSelectedStageId()
        ? 'Target ready. Pick a page element.'
        : 'Select application and stage first.'
      : 'Connect to Trails first.';
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
