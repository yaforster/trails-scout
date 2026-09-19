import type { QueueCandidate, QueueItem, QueueTarget } from './queue-controller';
import { toElementDefinition } from './token-utils';
import type { LocatorValidationResult } from '../locator-selectors';
import { trimTrailingSlash } from './utils';
import type {
  ElementDefinition,
  ElementType,
  ElementResource,
  LocatorCandidate,
  LocatorType,
  PersistedElement,
  SelectedLocator,
  StatusType,
} from './types';

interface ElementControllerElements {
  trailsServiceUrlInput: HTMLInputElement;
  locatorCandidateInput: HTMLSelectElement;
  locatorOutput: HTMLTextAreaElement;
  copyLocatorFeedback?: HTMLElement;
  locatorValidationFeedback?: HTMLElement;
  editLocatorButton?: HTMLButtonElement;
  validateLocatorButton?: HTMLButtonElement;
  retryScreenshotButton?: HTMLButtonElement;
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
  getScreenshot?(): Blob | null;
  clearScreenshot?(): void;
  uploadScreenshot?(
    uploadHref: string,
    screenshot: Blob,
    accessToken: string | null,
  ): Promise<void>;
  saveSettings(): Promise<void>;
  setStatus(message: string, type?: StatusType): void;
}

export interface ElementController {
  createElement(): Promise<void>;
  copyLocator(): Promise<void>;
  getSelectedLocator(): SelectedLocator | null;
  getCurrentLocator(): { locatorType: LocatorType; locatorString: string } | null;
  getQueueCandidate(target: QueueTarget | null): QueueCandidate | null;
  refreshSelectedLocator(): void;
  restoreSelectedLocator(locator: SelectedLocator | null): void;
  setSelectedLocator(locator: SelectedLocator): void;
  selectLocatorCandidate(): void;
  refreshCreateAvailability(): void;
  validateCurrentLocator(): Promise<void>;
  editLocator(): void;
  handleLocatorInput(): void;
  retryScreenshotUpload(): Promise<void>;
  createQueuedElement(item: QueueItem): Promise<void>;
}

export function createElementController(
  elements: ElementControllerElements,
  dependencies: ElementControllerDependencies,
): ElementController {
  let selectedLocator: SelectedLocator | null = null;
  let activeCandidateIndex = 0;
  let requestActive = false;
  let validation: LocatorValidationResult | null = null;
  let creationComplete = false;
  let pendingScreenshotUpload: { href: string; blob: Blob } | null = null;

  const {
    trailsServiceUrlInput,
    locatorCandidateInput,
    locatorOutput,
    copyLocatorFeedback,
    locatorValidationFeedback,
    editLocatorButton,
    validateLocatorButton,
    retryScreenshotButton,
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
    getScreenshot = () => null,
    clearScreenshot = () => undefined,
    uploadScreenshot = async () => {
      throw new Error('Screenshot upload is unavailable.');
    },
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
      const createdElement = await submitDefinition(definition, createElementHref);
      creationComplete = true;
      const screenshot = getScreenshot();
      if (!screenshot) {
        setStatus('Element created.', 'success');
        return;
      }

      const uploadHref = screenshotUploadHref(createdElement, applicationId, stageId);
      if (!uploadHref) {
        setStatus(
          'Element created; service did not return an element ID for screenshot upload.',
          'error',
        );
        return;
      }
      pendingScreenshotUpload = { href: uploadHref, blob: screenshot };
      try {
        await uploadScreenshot(uploadHref, screenshot, getAccessToken());
        pendingScreenshotUpload = null;
        clearScreenshot();
        if (retryScreenshotButton) {
          retryScreenshotButton.hidden = true;
        }
        setStatus('Element and screenshot created.', 'success');
      } catch (error) {
        if (retryScreenshotButton) {
          retryScreenshotButton.hidden = false;
        }
        setStatus(`Element created; screenshot upload failed: ${String(error)}`, 'error');
      }
    } catch (error) {
      setStatus(error instanceof DuplicateElementError ? error.message : String(error), 'error');
    } finally {
      requestActive = false;
      refreshCreateAvailability();
    }
  }

  async function createQueuedElement(item: QueueItem): Promise<void> {
    const currentApplicationId = getSelectedApplicationId();
    const currentStageId = getSelectedStageId();
    if (
      currentApplicationId !== item.target.applicationId ||
      currentStageId !== item.target.stageId
    ) {
      throw new Error('Queued element target no longer matches the selected target.');
    }
    const createElementHref = getCreateElementHref();
    if (!createElementHref) {
      throw new Error('Trails service does not advertise element creation.');
    }
    await submitDefinition(item.definition, createElementHref);
  }

  async function submitDefinition(
    definition: ElementDefinition,
    createElementHref: string,
  ): Promise<PersistedElement> {
    const existingElements = await getExistingElements();
    const duplicate = existingElements.find(
      (element) =>
        !element.retired &&
        element.locatorType === definition.locatorType &&
        element.locatorString === definition.locatorString,
    );
    if (duplicate) {
      throw new DuplicateElementError(
        `Element already exists: ${duplicate.label ?? 'Unnamed'} (${duplicate.type ?? 'unknown'}).`,
      );
    }
    await saveSettings();
    return (await putElement(createElementHref, definition, getAccessToken())) as PersistedElement;
  }

  function screenshotUploadHref(
    element: PersistedElement,
    applicationId: string,
    stageId: string,
  ): string | null {
    const { id } = element;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 0) {
      return null;
    }
    return `${trimTrailingSlash(trailsServiceUrlInput.value)}/api/applications/${applicationId}/stages/${stageId}/elements/${id}/screenshot`;
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
      isCurrentValidation(validation) &&
      !creationComplete,
    );
  }

  function getSelectedLocator(): SelectedLocator | null {
    return selectedLocator;
  }

  function getCurrentLocator(): { locatorType: LocatorType; locatorString: string } | null {
    const candidate = activeCandidate();
    return candidate
      ? { locatorType: candidate.locatorType, locatorString: candidate.locatorString }
      : null;
  }

  function getQueueCandidate(target: QueueTarget | null): QueueCandidate | null {
    if (
      !target ||
      !validation ||
      validation.status !== 'unique' ||
      !isCurrentValidation(validation)
    ) {
      return null;
    }
    const result = toElementDefinition(
      activeCandidate(),
      elementTypeInput.value as ElementType,
      elementLabelInput.value,
    );
    return result.valid ? { target, definition: result.definition, validation } : null;
  }

  function refreshSelectedLocator(): void {
    renderCandidateOptions();
    locatorOutput.value = activeCandidate()?.locatorString ?? '';
    validation = null;
    setValidationFeedback('Locator requires validation.', 'error');
    refreshCreateAvailability();
  }

  function restoreSelectedLocator(locator: SelectedLocator | null): void {
    selectedLocator = locator;
    activeCandidateIndex = 0;
    validation = null;
  }

  function setSelectedLocator(locator: SelectedLocator): void {
    selectedLocator = locator;
    activeCandidateIndex = 0;
    validation = null;
    creationComplete = false;
    pendingScreenshotUpload = null;
    locatorOutput.readOnly = true;
    if (editLocatorButton) {
      editLocatorButton.disabled = false;
      editLocatorButton.textContent = 'Edit locator';
    }
    refreshSelectedLocator();
  }

  async function validateCurrentLocator(): Promise<void> {
    const candidate = activeCandidate();
    if (!candidate) {
      setValidationFeedback('Pick a locator first.', 'error');
      return;
    }
    const { locatorType, locatorString } = candidate;
    if (validateLocatorButton) {
      validateLocatorButton.disabled = true;
    }
    try {
      const result = await validateLocator(locatorType, locatorString);
      if (!isActiveLocator(locatorType, locatorString)) {
        return;
      }
      validation = result;
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
    const candidate = activeCandidate();
    if (!candidate) {
      return;
    }
    candidate.locatorString = locatorOutput.value;
    validation = null;
    creationComplete = false;
    pendingScreenshotUpload = null;
    setValidationFeedback('Locator changed. Validate again.', 'error');
    refreshCreateAvailability();
  }

  async function retryScreenshotUpload(): Promise<void> {
    if (!pendingScreenshotUpload) {
      setStatus('No screenshot upload is waiting for retry.', 'error');
      return;
    }
    try {
      await uploadScreenshot(
        pendingScreenshotUpload.href,
        pendingScreenshotUpload.blob,
        getAccessToken(),
      );
      pendingScreenshotUpload = null;
      clearScreenshot();
      if (retryScreenshotButton) {
        retryScreenshotButton.hidden = true;
      }
      setStatus('Screenshot uploaded.', 'success');
    } catch (error) {
      setStatus(`Screenshot upload failed: ${String(error)}`, 'error');
    }
  }

  function setCopyFeedback(message: string, type: 'success' | 'error'): void {
    if (!copyLocatorFeedback) {
      return;
    }
    copyLocatorFeedback.textContent = message;
    copyLocatorFeedback.className = `field-feedback ${type}`;
  }

  function setValidationFeedback(message: string, type: 'success' | 'error'): void {
    if (locatorValidationFeedback) {
      locatorValidationFeedback.textContent = message;
      locatorValidationFeedback.className = `field-feedback ${type}`;
    }
  }

  function isCurrentValidation(result: LocatorValidationResult): boolean {
    return isActiveLocator(result.locatorType, result.locatorString);
  }

  function isActiveLocator(locatorType: LocatorType, locatorString: string): boolean {
    const candidate = activeCandidate();
    return candidate?.locatorType === locatorType && candidate.locatorString === locatorString;
  }

  function readElementDefinition(): ElementDefinition | null {
    const result = toElementDefinition(
      activeCandidate(),
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
    return activeCandidate()?.locatorString ?? '';
  }

  function activeCandidate(): LocatorCandidate | null {
    return selectedLocator?.candidates[activeCandidateIndex] ?? null;
  }

  function selectLocatorCandidate(): void {
    const index = Number(locatorCandidateInput.value);
    if (!Number.isInteger(index) || !selectedLocator?.candidates[index]) {
      return;
    }
    activeCandidateIndex = index;
    locatorOutput.readOnly = true;
    if (editLocatorButton) {
      editLocatorButton.disabled = false;
      editLocatorButton.textContent = 'Edit locator';
    }
    refreshSelectedLocator();
  }

  function renderCandidateOptions(): void {
    locatorCandidateInput.replaceChildren();
    for (const [index, candidate] of (selectedLocator?.candidates ?? []).entries()) {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${candidate.locatorType}: ${candidate.strategy}`;
      locatorCandidateInput.appendChild(option);
    }
    if (locatorCandidateInput.options.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Pick a page element first';
      locatorCandidateInput.appendChild(option);
      locatorCandidateInput.disabled = true;
      return;
    }
    activeCandidateIndex = Math.min(activeCandidateIndex, locatorCandidateInput.options.length - 1);
    locatorCandidateInput.disabled = false;
    locatorCandidateInput.value = String(activeCandidateIndex);
  }

  return {
    createElement,
    getSelectedLocator,
    getCurrentLocator,
    getQueueCandidate,
    refreshSelectedLocator,
    restoreSelectedLocator,
    setSelectedLocator,
    selectLocatorCandidate,
    copyLocator,
    refreshCreateAvailability,
    validateCurrentLocator,
    editLocator,
    handleLocatorInput,
    retryScreenshotUpload,
    createQueuedElement,
  };
}

class DuplicateElementError extends Error {}
