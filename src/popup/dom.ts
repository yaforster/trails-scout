import type { ElementType, LocatorType } from './types';

export function requiredInput(id: string): HTMLInputElement {
  return requiredElement<HTMLInputElement>(id);
}

export function requiredTextArea(id: string): HTMLTextAreaElement {
  return requiredElement<HTMLTextAreaElement>(id);
}

export function requiredSelect<T extends string>(id: string): HTMLSelectElement & { value: T } {
  return requiredElement<HTMLSelectElement>(id) as HTMLSelectElement & { value: T };
}

export function requiredButton(id: string): HTMLButtonElement {
  return requiredElement<HTMLButtonElement>(id);
}

export function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing popup element #${id}.`);
  }

  return element as T;
}

export function getPopupElements() {
  return {
    trailsServiceUrlInput: requiredInput('trailsServiceUrl'),
    keycloakUrlInput: requiredInput('keycloakUrl'),
    usernameInput: requiredInput('username'),
    passwordInput: requiredInput('password'),
    clientIdInput: requiredInput('clientId'),
    clientSecretInput: requiredInput('clientSecret'),
    applicationSelect: requiredSelect<string>('applicationSelect'),
    stageSelect: requiredSelect<string>('stageSelect'),
    refreshResourcesButton: requiredButton('refreshResourcesButton'),
    targetSummary: requiredElement<HTMLParagraphElement>('targetSummary'),
    testTrailsConnectionButton: requiredButton('testTrailsConnectionButton'),
    trailsConnectionFeedback: requiredElement<HTMLDivElement>('trailsConnectionFeedback'),
    locatorTypeInput: requiredSelect<LocatorType>('locatorType'),
    locatorOutput: requiredTextArea('locatorOutput'),
    editLocatorButton: requiredButton('editLocatorButton'),
    validateLocatorButton: requiredButton('validateLocatorButton'),
    locatorValidationFeedback: requiredElement<HTMLSpanElement>('locatorValidationFeedback'),
    locatorCssOutput: requiredInput('locatorCssOutput'),
    locatorXpathOutput: requiredInput('locatorXpathOutput'),
    locatorCssFeedback: requiredElement<HTMLSpanElement>('locatorCssFeedback'),
    locatorXpathFeedback: requiredElement<HTMLSpanElement>('locatorXpathFeedback'),
    copyLocatorButton: requiredButton('copyLocatorButton'),
    copyLocatorFeedback: requiredElement<HTMLSpanElement>('copyLocatorFeedback'),
    captureScreenshotButton: requiredButton('captureScreenshotButton'),
    replaceScreenshotButton: requiredButton('replaceScreenshotButton'),
    removeScreenshotButton: requiredButton('removeScreenshotButton'),
    retryScreenshotButton: requiredButton('retryScreenshotButton'),
    screenshotPreview: requiredElement<HTMLImageElement>('screenshotPreview'),
    screenshotDetails: requiredElement<HTMLSpanElement>('screenshotDetails'),
    screenshotFeedback: requiredElement<HTMLSpanElement>('screenshotFeedback'),
    elementTargetSummary: requiredElement<HTMLParagraphElement>('elementTargetSummary'),
    captureBlocker: requiredElement<HTMLParagraphElement>('captureBlocker'),
    elementTypeInput: requiredSelect<ElementType>('elementType'),
    elementLabelInput: requiredInput('elementLabel'),
    loginButton: requiredButton('loginButton'),
    showTokenButton: requiredButton('showTokenButton'),
    showTokenIcon: requiredElement<HTMLElement>('showTokenIcon'),
    showTokenLabel: requiredElement<HTMLSpanElement>('showTokenLabel'),
    startInspectorButton: requiredButton('startInspectorButton'),
    createElementButton: requiredButton('createElementButton'),
    statusElement: requiredElement<HTMLDivElement>('status'),
    tokenFeedback: requiredElement<HTMLDivElement>('tokenFeedback'),
    tokenFeedbackIcon: requiredElement<HTMLElement>('tokenFeedbackIcon'),
    tokenFeedbackText: requiredElement<HTMLSpanElement>('tokenFeedbackText'),
    tokenBox: requiredElement<HTMLDivElement>('tokenBox'),
    tokenOutput: requiredTextArea('tokenOutput'),
    authTab: requiredButton('authTab'),
    targetTab: requiredButton('targetTab'),
    elementTab: requiredButton('elementTab'),
    authPanel: requiredElement<HTMLElement>('authPanel'),
    targetPanel: requiredElement<HTMLElement>('targetPanel'),
    elementPanel: requiredElement<HTMLElement>('elementPanel'),
    settingsMenuContainer: requiredElement<HTMLDivElement>('settingsMenuContainer'),
    settingsButton: requiredButton('settingsButton'),
    themeToggle: requiredButton('themeToggle'),
    settingsMenu: requiredElement<HTMLDivElement>('settingsMenu'),
    deleteTokenButton: requiredButton('deleteTokenButton'),
  };
}
