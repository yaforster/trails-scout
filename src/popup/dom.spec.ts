import { beforeEach, describe, expect, it } from 'vitest';
import {
  getPopupElements,
  requiredButton,
  requiredElement,
  requiredInput,
  requiredSelect,
  requiredTextArea,
} from './dom';

const inputIds = [
  'trailsServiceUrl',
  'keycloakUrl',
  'username',
  'password',
  'clientId',
  'clientSecret',
  'elementLabel',
  'locatorCssOutput',
  'locatorXpathOutput',
  'locatorCssFeedback',
  'locatorXpathFeedback',
];

const selectIds = ['applicationSelect', 'stageSelect', 'locatorType', 'elementType'];

const buttonIds = [
  'refreshResourcesButton',
  'testTrailsConnectionButton',
  'loginButton',
  'showTokenButton',
  'startInspectorButton',
  'createElementButton',
  'copyLocatorButton',
  'editLocatorButton',
  'validateLocatorButton',
  'addToQueueButton',
  'createQueueButton',
  'clearQueueButton',
  'captureScreenshotButton',
  'replaceScreenshotButton',
  'removeScreenshotButton',
  'retryScreenshotButton',
  'authTab',
  'targetTab',
  'elementTab',
  'settingsButton',
  'themeToggle',
  'deleteTokenButton',
];

const divIds = [
  'status',
  'tokenFeedback',
  'tokenBox',
  'authPanel',
  'targetPanel',
  'elementPanel',
  'settingsMenuContainer',
  'settingsMenu',
  'trailsConnectionFeedback',
  'targetSummary',
  'elementTargetSummary',
  'captureBlocker',
  'copyLocatorFeedback',
  'locatorValidationFeedback',
];

function renderPopupElements(): void {
  document.body.innerHTML = [
    ...inputIds.map((id) => `<input id="${id}" />`),
    ...selectIds.map((id) => `<select id="${id}"></select>`),
    `<textarea id="locatorOutput"></textarea>`,
    `<textarea id="tokenOutput"></textarea>`,
    ...buttonIds.map((id) => `<button id="${id}"></button>`),
    `<span id="showTokenLabel"></span>`,
    `<span id="tokenFeedbackText"></span>`,
    `<span id="screenshotDetails"></span>`,
    `<span id="screenshotFeedback"></span>`,
    `<span id="queueCount"></span>`,
    `<ol id="queueList"></ol>`,
    `<i id="showTokenIcon"></i>`,
    `<i id="tokenFeedbackIcon"></i>`,
    `<img id="screenshotPreview" />`,
    ...divIds.map((id) => `<div id="${id}"></div>`),
  ].join('');
}

describe('popup DOM helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns a required element', () => {
    document.body.innerHTML = `<div id="status"></div>`;

    expect(requiredElement('status')).toBe(document.getElementById('status'));
  });

  it('throws when a required element is missing', () => {
    expect(() => requiredElement('missing')).toThrow('Missing popup element #missing.');
  });

  it('returns typed input elements', () => {
    document.body.innerHTML = `<input id="username" />`;

    expect(requiredInput('username')).toBeInstanceOf(HTMLInputElement);
  });

  it('returns typed textarea elements', () => {
    document.body.innerHTML = `<textarea id="locatorOutput"></textarea>`;

    expect(requiredTextArea('locatorOutput')).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('returns typed select elements', () => {
    document.body.innerHTML = `<select id="locatorType"></select>`;

    expect(requiredSelect('locatorType')).toBeInstanceOf(HTMLSelectElement);
  });

  it('returns typed button elements', () => {
    document.body.innerHTML = `<button id="loginButton"></button>`;

    expect(requiredButton('loginButton')).toBeInstanceOf(HTMLButtonElement);
  });

  it('collects all popup elements on demand', () => {
    renderPopupElements();

    const result = getPopupElements();

    expect(result.loginButton).toBe(document.getElementById('loginButton'));
    expect(result.locatorOutput).toBe(document.getElementById('locatorOutput'));
  });
});
