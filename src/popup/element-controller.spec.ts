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
) {
  document.body.innerHTML = `
        <input id="trailsServiceUrl" value=" http://localhost:8080/ " />
        <select id="locatorType">
            <option value="CSS">CSS</option>
            <option value="XPATH">XPath</option>
        </select>
        <textarea id="locatorOutput"></textarea>
        <select id="elementType">
            <option value="BUTTON">BUTTON</option>
        </select>
        <input id="elementLabel" value=" Checkout " />
        <button id="createElementButton"></button>
    `;

  const putElement = vi.fn().mockResolvedValue({ id: 42 });
  const saveSettings = vi.fn().mockResolvedValue(undefined);
  const setStatus = vi.fn();
  const controller = createElementController(
    {
      trailsServiceUrlInput: document.getElementById('trailsServiceUrl') as HTMLInputElement,
      locatorTypeInput: document.getElementById('locatorType') as HTMLSelectElement,
      locatorOutput: document.getElementById('locatorOutput') as HTMLTextAreaElement,
      elementTypeInput: document.getElementById('elementType') as HTMLSelectElement,
      elementLabelInput: document.getElementById('elementLabel') as HTMLInputElement,
      createElementButton: document.getElementById('createElementButton') as HTMLButtonElement,
    },
    {
      getSelectedApplicationId: () => selection.applicationId,
      getSelectedStageId: () => selection.stageId,
      getAccessToken: () => 'access-token',
      putElement,
      saveSettings,
      setStatus,
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

    await controller.createElement();

    expect(saveSettings).toHaveBeenCalled();
    expect(putElement).toHaveBeenCalledWith(
      'http://localhost:8080',
      '7',
      '8',
      {
        type: 'BUTTON',
        label: 'Checkout',
        locatorString: '#checkout',
        locatorType: 'CSS',
      },
      'access-token',
    );
    expect(setStatus).toHaveBeenLastCalledWith('Element created.', 'success');
    expect(createElementButton.disabled).toBe(false);
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
    putElement.mockRejectedValueOnce(new Error('Element already exists.'));

    await controller.createElement();

    expect(createElementButton.disabled).toBe(false);
    expect(setStatus).toHaveBeenLastCalledWith('Error: Element already exists.', 'error');
  });
});
