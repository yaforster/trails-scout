import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElementController } from './element-controller';
import type { SelectedLocator } from './types';

vi.mock('webextension-polyfill', () => ({ default: {} }));

const locator: SelectedLocator = {
  cssSelector: '#checkout',
  xpath: `//*[@id="checkout"]`,
  selectedAt: '2026-05-19T20:00:00.000Z',
};

function createHarness(
  selection: { applicationId: string | null; stageId: string | null } = {
    applicationId: '7',
    stageId: '8',
  },
  existingElements: object[] = [],
  screenshot: Blob | null = null,
) {
  document.body.innerHTML = `
        <input id="trailsServiceUrl" value=" http://localhost:8080/ " />
        <select id="locatorType">
            <option value="CSS">CSS</option>
            <option value="XPATH">XPath</option>
        </select>
        <textarea id="locatorOutput"></textarea>
        <input id="locatorCssOutput" />
        <input id="locatorXpathOutput" />
        <button id="copyLocatorButton"></button>
        <span id="copyLocatorFeedback"></span>
        <button id="editLocatorButton"></button>
        <button id="validateLocatorButton"></button>
        <button id="retryScreenshotButton" hidden></button>
        <span id="locatorValidationFeedback"></span>
        <span id="locatorCssFeedback"></span>
        <span id="locatorXpathFeedback"></span>
        <select id="elementType">
            <option value="BUTTON">BUTTON</option>
        </select>
        <input id="elementLabel" value=" Checkout " />
        <button id="createElementButton"></button>
    `;

  const putElement = vi.fn().mockResolvedValue({ id: 42 });
  const saveSettings = vi.fn().mockResolvedValue(undefined);
  const setStatus = vi.fn();
  const uploadScreenshot = vi.fn().mockResolvedValue(undefined);
  const validateLocator = vi.fn().mockResolvedValue({
    type: 'TRAILS_LOCATOR_VALIDATED',
    requestId: 'test',
    locatorType: 'CSS',
    locatorString: '#checkout',
    matchCount: 1,
    status: 'unique',
    message: 'One matching element found.',
  });
  const controller = createElementController(
    {
      trailsServiceUrlInput: document.getElementById('trailsServiceUrl') as HTMLInputElement,
      locatorTypeInput: document.getElementById('locatorType') as HTMLSelectElement,
      locatorOutput: document.getElementById('locatorOutput') as HTMLTextAreaElement,
      locatorCssOutput: document.getElementById('locatorCssOutput') as HTMLInputElement,
      locatorXpathOutput: document.getElementById('locatorXpathOutput') as HTMLInputElement,
      copyLocatorFeedback: document.getElementById('copyLocatorFeedback') as HTMLSpanElement,
      retryScreenshotButton: document.getElementById('retryScreenshotButton') as HTMLButtonElement,
      elementTypeInput: document.getElementById('elementType') as HTMLSelectElement,
      elementLabelInput: document.getElementById('elementLabel') as HTMLInputElement,
      createElementButton: document.getElementById('createElementButton') as HTMLButtonElement,
    },
    {
      getSelectedApplicationId: () => selection.applicationId,
      getSelectedStageId: () => selection.stageId,
      getCreateElementHref: () => 'http://localhost:8080/api/elements',
      getAccessToken: () => 'access-token',
      putElement,
      saveSettings,
      setStatus,
      validateLocator,
      getExistingElements: vi.fn().mockResolvedValue(existingElements),
      getScreenshot: () => screenshot,
      clearScreenshot: vi.fn(),
      uploadScreenshot,
    },
  );

  return {
    controller,
    createElementButton: document.getElementById('createElementButton') as HTMLButtonElement,
    elementLabelInput: document.getElementById('elementLabel') as HTMLInputElement,
    putElement,
    saveSettings,
    locatorOutput: document.getElementById('locatorOutput') as HTMLTextAreaElement,
    locatorTypeInput: document.getElementById('locatorType') as HTMLSelectElement,
    setStatus,
    uploadScreenshot,
    retryScreenshotButton: document.getElementById('retryScreenshotButton') as HTMLButtonElement,
  };
}

describe('element controller', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the selected locator with the active locator type', () => {
    const { controller, locatorOutput, locatorTypeInput } = createHarness();

    controller.setSelectedLocator(locator);
    expect(locatorOutput.value).toBe('#checkout');

    locatorTypeInput.value = 'XPATH';
    controller.refreshSelectedLocator();
    expect(locatorOutput.value).toBe(`//*[@id="checkout"]`);
  });

  it('copies active locator only after clipboard resolves', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const { controller, setStatus } = createHarness();
    controller.setSelectedLocator(locator);

    await controller.copyLocator();

    expect(writeText).toHaveBeenCalledWith('#checkout');
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('reports clipboard failures', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('Denied.')) },
    });
    const { controller } = createHarness();
    controller.setSelectedLocator(locator);

    await controller.copyLocator();

    expect(document.getElementById('copyLocatorFeedback')?.textContent).toBe('Error: Denied.');
  });

  it('restores a selected locator without forcing a render', () => {
    const { controller, locatorOutput } = createHarness();

    controller.restoreSelectedLocator(locator);

    expect(controller.getSelectedLocator()).toEqual(locator);
    expect(locatorOutput.value).toBe('');
  });

  it('creates an element for the selected application stage', async () => {
    const { controller, createElementButton, putElement, saveSettings, setStatus } =
      createHarness();
    controller.setSelectedLocator(locator);
    await controller.validateCurrentLocator();

    await controller.createElement();

    expect(putElement).toHaveBeenCalledWith(
      'http://localhost:8080/api/elements',
      expect.objectContaining({ label: 'Checkout' }),
      'access-token',
    );

    expect(saveSettings).toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith('Element created.', 'success');
    expect(createElementButton.disabled).toBe(true);
  });

  it('rejects creation when no locator has been selected', async () => {
    const { controller, putElement, setStatus } = createHarness();

    await controller.createElement();

    expect(putElement).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith('Pick a locator before creating an element.', 'error');
  });

  it('rejects creation when the application stage selection is incomplete', async () => {
    const { controller, putElement, setStatus } = createHarness({
      applicationId: '7',
      stageId: null,
    });
    controller.setSelectedLocator(locator);

    await controller.createElement();

    expect(putElement).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(
      'Trails service URL and application stage selection are required.',
      'error',
    );
  });

  it('reports element creation failures and re-enables the create button', async () => {
    const { controller, createElementButton, putElement, setStatus } = createHarness();
    controller.setSelectedLocator(locator);
    await controller.validateCurrentLocator();
    putElement.mockRejectedValueOnce(new Error('Element already exists.'));

    await controller.createElement();

    expect(createElementButton.disabled).toBe(false);
    expect(setStatus).toHaveBeenLastCalledWith('Error: Element already exists.', 'error');
  });

  it('prevents duplicate create requests', async () => {
    const { controller, putElement } = createHarness();
    controller.setSelectedLocator(locator);
    await controller.validateCurrentLocator();
    let resolveRequest!: () => void;
    putElement.mockReturnValueOnce(new Promise((resolve) => (resolveRequest = () => resolve({}))));

    const first = controller.createElement();
    const second = controller.createElement();
    resolveRequest();
    await Promise.all([first, second]);

    expect(putElement).toHaveBeenCalledTimes(1);
  });

  it('blocks exact active locator duplicates before PUT', async () => {
    const { controller, putElement, setStatus } = createHarness(
      { applicationId: '7', stageId: '8' },
      [
        {
          label: 'Existing checkout',
          type: 'BUTTON',
          locatorType: 'CSS',
          locatorString: '#checkout',
          retired: false,
        },
      ],
    );
    controller.setSelectedLocator(locator);
    await controller.validateCurrentLocator();

    await controller.createElement();

    expect(putElement).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith(
      'Element already exists: Existing checkout (BUTTON).',
      'error',
    );
  });

  it('keeps created element outcome and retries failed screenshot upload', async () => {
    const screenshot = new Blob(['png'], { type: 'image/png' });
    const { controller, putElement, uploadScreenshot, retryScreenshotButton, setStatus } =
      createHarness(undefined, [], screenshot);
    putElement.mockResolvedValue({
      id: 42,
      _links: { uploadScreenshot: { href: '/api/elements/42/screenshot', method: 'PUT' } },
    });
    uploadScreenshot.mockRejectedValueOnce(new Error('Service unavailable.'));
    controller.setSelectedLocator(locator);
    await controller.validateCurrentLocator();

    await controller.createElement();

    expect(putElement).toHaveBeenCalledTimes(1);
    expect(setStatus).toHaveBeenLastCalledWith(
      'Element created; screenshot upload failed: Error: Service unavailable.',
      'error',
    );
    expect(retryScreenshotButton.hidden).toBe(false);

    await controller.retryScreenshotUpload();

    expect(uploadScreenshot).toHaveBeenCalledTimes(2);
    expect(putElement).toHaveBeenCalledTimes(1);
    expect(setStatus).toHaveBeenLastCalledWith('Screenshot uploaded.', 'success');
  });
});
