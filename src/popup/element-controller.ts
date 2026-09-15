import { locatorStringFor, toElementDefinition } from './token-utils';
import type {
  ElementDefinition,
  ElementType,
  LocatorType,
  SelectedLocator,
  StatusType,
} from './types';
import { trimTrailingSlash } from './utils';

interface ElementControllerElements {
  trailsServiceUrlInput: HTMLInputElement;
  locatorTypeInput: HTMLSelectElement;
  locatorOutput: HTMLTextAreaElement;
  elementTypeInput: HTMLSelectElement;
  elementLabelInput: HTMLInputElement;
  createElementButton: HTMLButtonElement;
}

interface ElementControllerDependencies {
  getSelectedApplicationId(): string | null;
  getSelectedStageId(): string | null;
  getAccessToken(): string | null;
  putElement(
    trailsServiceUrl: string,
    applicationId: string,
    stageId: string,
    definition: ElementDefinition,
    accessToken: string | null,
  ): Promise<unknown>;
  saveSettings(): Promise<void>;
  setStatus(message: string, type?: StatusType): void;
}

export interface ElementController {
  createElement(): Promise<void>;
  getSelectedLocator(): SelectedLocator | null;
  refreshSelectedLocator(): void;
  restoreSelectedLocator(locator: SelectedLocator | null): void;
  setSelectedLocator(locator: SelectedLocator): void;
}

export function createElementController(
  elements: ElementControllerElements,
  dependencies: ElementControllerDependencies,
): ElementController {
  let selectedLocator: SelectedLocator | null = null;

  const {
    trailsServiceUrlInput,
    locatorTypeInput,
    locatorOutput,
    elementTypeInput,
    elementLabelInput,
    createElementButton,
  } = elements;

  const {
    getSelectedApplicationId,
    getSelectedStageId,
    getAccessToken,
    putElement,
    saveSettings,
    setStatus,
  } = dependencies;

  async function createElement(): Promise<void> {
    const definition = readElementDefinition();
    if (!definition) {
      return;
    }

    const trailsServiceUrl = trimTrailingSlash(trailsServiceUrlInput.value);
    const applicationId = getSelectedApplicationId();
    const stageId = getSelectedStageId();

    if (!trailsServiceUrl || !applicationId || !stageId) {
      setStatus('Trails service URL and application stage selection are required.', 'error');
      return;
    }

    createElementButton.disabled = true;
    setStatus('Creating element in Trails...');

    try {
      await saveSettings();
      await putElement(trailsServiceUrl, applicationId, stageId, definition, getAccessToken());
      setStatus('Element created.', 'success');
    } catch (error) {
      setStatus(String(error), 'error');
    } finally {
      createElementButton.disabled = false;
    }
  }

  function getSelectedLocator(): SelectedLocator | null {
    return selectedLocator;
  }

  function refreshSelectedLocator(): void {
    locatorOutput.value = currentLocatorString();
  }

  function restoreSelectedLocator(locator: SelectedLocator | null): void {
    selectedLocator = locator;
  }

  function setSelectedLocator(locator: SelectedLocator): void {
    selectedLocator = locator;
    refreshSelectedLocator();
  }

  function readElementDefinition(): ElementDefinition | null {
    const result = toElementDefinition(
      selectedLocator,
      locatorTypeInput.value as LocatorType,
      elementTypeInput.value as ElementType,
      elementLabelInput.value,
    );

    if (!result.valid) {
      setStatus(result.message, 'error');
      return null;
    }

    return result.definition;
  }

  function currentLocatorString(): string {
    return locatorStringFor(selectedLocator, locatorTypeInput.value as LocatorType);
  }

  return {
    createElement,
    getSelectedLocator,
    refreshSelectedLocator,
    restoreSelectedLocator,
    setSelectedLocator,
  };
}
