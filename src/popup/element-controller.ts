import { locatorStringFor, toElementDefinition } from './token-utils';
import type { LocatorValidationResult } from '../locator-selectors';
import type {
  ElementDefinition,
  ElementType,
  ElementResource,
  LocatorType,
  SelectedLocator,
  StatusType,
} from './types';

interface ElementControllerElements {
  trailsServiceUrlInput: HTMLInputElement;
  locatorTypeInput: HTMLSelectElement;
  locatorOutput: HTMLTextAreaElement;
  locatorCssOutput?: HTMLInputElement;
  locatorXpathOutput?: HTMLInputElement;
  copyLocatorFeedback?: HTMLElement;
  locatorValidationFeedback?: HTMLElement;
  locatorCssFeedback?: HTMLElement;
  locatorXpathFeedback?: HTMLElement;
  editLocatorButton?: HTMLButtonElement;
  validateLocatorButton?: HTMLButtonElement;
  elementTypeInput: HTMLSelectElement;
  elementLabelInput: HTMLInputElement;
  createElementButton: HTMLButtonElement;
}

interface ElementControllerDependencies {
  getSelectedApplicationId(): string | null;
  getSelectedStageId(): string | null;
  getCreateElementHref(): string | null;
  getAccessToken(): string | null;
  putElement(
    createElementHref: string,
    definition: ElementDefinition,
    accessToken: string | null,
  ): Promise<unknown>;
  validateLocator(
    locatorType: LocatorType,
    locatorString: string,
  ): Promise<LocatorValidationResult>;
  getExistingElements(): Promise<ElementResource[]>;
  saveSettings(): Promise<void>;
  setStatus(message: string, type?: StatusType): void;
}

export interface ElementController {
  createElement(): Promise<void>;
  copyLocator(): Promise<void>;
  getSelectedLocator(): SelectedLocator | null;
  refreshSelectedLocator(): void;
  restoreSelectedLocator(locator: SelectedLocator | null): void;
  setSelectedLocator(locator: SelectedLocator): void;
  refreshCreateAvailability(): void;
  validateCurrentLocator(): Promise<void>;
  editLocator(): void;
  handleLocatorInput(): void;
}

export function createElementController(
  elements: ElementControllerElements,
  dependencies: ElementControllerDependencies,
): ElementController {
  let selectedLocator: SelectedLocator | null = null;
  let requestActive = false;
  let validation: LocatorValidationResult | null = null;

  const {
    trailsServiceUrlInput,
    locatorTypeInput,
    locatorOutput,
    locatorCssOutput,
    locatorXpathOutput,
    copyLocatorFeedback,
    locatorValidationFeedback,
    locatorCssFeedback,
    locatorXpathFeedback,
    editLocatorButton,
    validateLocatorButton,
    elementTypeInput,
    elementLabelInput,
    createElementButton,
  } = elements;

  const {
    getSelectedApplicationId,
    getSelectedStageId,
    getCreateElementHref,
    getAccessToken,
    putElement,
    validateLocator,
    getExistingElements,
    saveSettings,
    setStatus,
  } = dependencies;

  async function createElement(): Promise<void> {
    if (requestActive) {
      return;
    }
    const definition = readElementDefinition();
    if (!definition) {
      return;
    }

    const applicationId = getSelectedApplicationId();
    const stageId = getSelectedStageId();
    const createElementHref = getCreateElementHref();

    if (!trailsServiceUrlInput.value.trim() || !applicationId || !stageId) {
      setStatus('Trails service URL and application stage selection are required.', 'error');
      return;
    }
    if (!createElementHref) {
      setStatus('Trails service does not advertise element creation.', 'error');
      return;
    }
    if (!validation || validation.status !== 'unique' || !isCurrentValidation(validation)) {
      setStatus('Validate locator and confirm one matching page element first.', 'error');
      return;
    }

    createElementButton.disabled = true;
    requestActive = true;
    setStatus('Creating element in Trails...');

    try {
      const existingElements = await getExistingElements();
      const duplicate = existingElements.find(
        (element) =>
          !element.retired &&
          element.locatorType === definition.locatorType &&
          element.locatorString === definition.locatorString,
      );
      if (duplicate) {
        setStatus(
          `Element already exists: ${duplicate.label ?? 'Unnamed'} (${duplicate.type ?? 'unknown'}).`,
          'error',
        );
        return;
      }
      await saveSettings();
      await putElement(createElementHref, definition, getAccessToken());
      setStatus('Element created.', 'success');
    } catch (error) {
      setStatus(String(error), 'error');
    } finally {
      requestActive = false;
      refreshCreateAvailability();
    }
  }

  async function copyLocator(): Promise<void> {
    const locator = currentLocatorString();
    if (!locator) {
      setCopyFeedback('Pick a locator first.', 'error');
      return;
    }

    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard is unavailable.');
      }
      await navigator.clipboard.writeText(locator);
      setCopyFeedback('Locator copied.', 'success');
    } catch (error) {
      setCopyFeedback(String(error), 'error');
    }
  }

  function refreshCreateAvailability(): void {
    createElementButton.disabled = !Boolean(
      trailsServiceUrlInput.value.trim() &&
      getSelectedApplicationId() &&
      getSelectedStageId() &&
      getCreateElementHref() &&
      selectedLocator &&
      currentLocatorString() &&
      elementLabelInput.value.trim() &&
      validation?.status === 'unique' &&
      isCurrentValidation(validation),
    );
  }

  function getSelectedLocator(): SelectedLocator | null {
    return selectedLocator;
  }

  function refreshSelectedLocator(): void {
    locatorOutput.value = currentLocatorString();
    if (locatorCssOutput) {
      locatorCssOutput.value = locatorStringFor(selectedLocator, 'CSS');
    }
    if (locatorXpathOutput) {
      locatorXpathOutput.value = locatorStringFor(selectedLocator, 'XPATH');
    }
    validation = null;
    setValidationFeedback('Locator requires validation.', 'error');
    refreshCreateAvailability();
  }

  function restoreSelectedLocator(locator: SelectedLocator | null): void {
    selectedLocator = locator;
    validation = null;
  }

  function setSelectedLocator(locator: SelectedLocator): void {
    selectedLocator = locator;
    validation = null;
    refreshSelectedLocator();
  }

  async function validateCurrentLocator(): Promise<void> {
    const locatorString = currentLocatorString();
    if (!locatorString) {
      setValidationFeedback('Pick a locator first.', 'error');
      return;
    }
    if (validateLocatorButton) {
      validateLocatorButton.disabled = true;
    }
    try {
      validation = await validateLocator(locatorTypeInput.value as LocatorType, locatorString);
      setValidationFeedback(
        validation.message,
        validation.status === 'unique' ? 'success' : 'error',
      );
    } catch (error) {
      validation = null;
      setValidationFeedback(String(error), 'error');
    } finally {
      if (validateLocatorButton) {
        validateLocatorButton.disabled = false;
      }
      refreshCreateAvailability();
    }
  }

  function editLocator(): void {
    locatorOutput.readOnly = false;
    locatorOutput.focus();
    if (editLocatorButton) {
      editLocatorButton.disabled = true;
      editLocatorButton.textContent = 'Editing locator';
    }
  }

  function handleLocatorInput(): void {
    if (!selectedLocator) {
      return;
    }
    if (locatorTypeInput.value === 'XPATH') {
      selectedLocator.xpath = locatorOutput.value;
    } else {
      selectedLocator.cssSelector = locatorOutput.value;
    }
    validation = null;
    setValidationFeedback('Locator changed. Validate again.', 'error');
    refreshCreateAvailability();
  }

  function setCopyFeedback(message: string, type: 'success' | 'error'): void {
    if (!copyLocatorFeedback) {
      return;
    }
    copyLocatorFeedback.textContent = message;
    copyLocatorFeedback.className = `field-feedback ${type}`;
  }

  function setValidationFeedback(message: string, type: 'success' | 'error'): void {
    const candidateFeedback =
      locatorTypeInput.value === 'CSS' ? locatorCssFeedback : locatorXpathFeedback;
    if (candidateFeedback) {
      candidateFeedback.textContent = message;
      candidateFeedback.className = `field-feedback ${type}`;
    }
    if (locatorValidationFeedback) {
      locatorValidationFeedback.textContent = message;
      locatorValidationFeedback.className = `field-feedback ${type}`;
    }
  }

  function isCurrentValidation(result: LocatorValidationResult): boolean {
    return (
      result.locatorType === locatorTypeInput.value &&
      result.locatorString === currentLocatorString()
    );
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
    copyLocator,
    refreshCreateAvailability,
    validateCurrentLocator,
    editLocator,
    handleLocatorInput,
  };
}
