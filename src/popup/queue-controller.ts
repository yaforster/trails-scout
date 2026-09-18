import type { LocatorValidationResult } from '../locator-selectors';
import type { ElementDefinition } from './types';

export interface QueueTarget {
  applicationId: string;
  applicationLabel: string;
  stageId: string;
  stageLabel: string;
}

export interface QueueCandidate {
  target: QueueTarget;
  definition: ElementDefinition;
  validation: LocatorValidationResult;
}

export interface QueueItem {
  id: number;
  target: QueueTarget;
  definition: ElementDefinition;
  validation: LocatorValidationResult;
  status: 'queued' | 'creating' | 'created' | 'failed';
  error?: string;
}

interface QueueControllerElements {
  addButton: HTMLButtonElement;
  createButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  count: HTMLElement;
  list: HTMLElement;
}

interface QueueControllerDependencies {
  getCandidate(): QueueCandidate | null;
  createElement(item: QueueItem): Promise<void>;
  setStatus(message: string, type?: 'idle' | 'success' | 'error'): void;
}

export interface QueueController {
  addCurrent(): void;
  remove(id: number): void;
  createAll(): Promise<void>;
  clear(): void;
  confirmTargetChange(): boolean;
  refreshAvailability(): void;
  getItems(): QueueItem[];
}

export function createQueueController(
  elements: QueueControllerElements,
  dependencies: QueueControllerDependencies,
): QueueController {
  let items: QueueItem[] = [];
  let nextId = 1;
  let requestActive = false;

  function addCurrent(): void {
    const candidate = dependencies.getCandidate();
    if (!candidate || candidate.validation.status !== 'unique') {
      dependencies.setStatus('Validate one unique locator before adding it to the queue.', 'error');
      return;
    }

    const existingTarget = items[0]?.target;
    if (existingTarget && !sameTarget(existingTarget, candidate.target)) {
      dependencies.setStatus('Queue items must use the same application and stage.', 'error');
      return;
    }
    if (
      items.some(
        (item) =>
          item.definition.locatorType === candidate.definition.locatorType &&
          item.definition.locatorString === candidate.definition.locatorString,
      )
    ) {
      dependencies.setStatus('This locator is already in the queue.', 'error');
      return;
    }

    items.push({
      id: nextId++,
      target: candidate.target,
      definition: candidate.definition,
      validation: candidate.validation,
      status: 'queued',
    });
    render();
    dependencies.setStatus(
      `${items.length} element${items.length === 1 ? '' : 's'} queued.`,
      'success',
    );
  }

  function remove(id: number): void {
    items = items.filter((item) => item.id !== id);
    render();
  }

  async function createAll(): Promise<void> {
    if (requestActive) {
      return;
    }
    const candidate = dependencies.getCandidate();
    if (!items.length) {
      dependencies.setStatus('Queue is empty.', 'error');
      return;
    }
    if (!candidate || !sameTarget(items[0].target, candidate.target)) {
      dependencies.setStatus('Select the queued application and stage before creating.', 'error');
      return;
    }

    requestActive = true;
    refreshAvailability();
    let created = 0;
    let failed = 0;
    try {
      for (const item of items) {
        if (item.status === 'created') {
          continue;
        }
        item.status = 'creating';
        item.error = undefined;
        render();
        try {
          await dependencies.createElement(item);
          item.status = 'created';
          created++;
        } catch (error) {
          item.status = 'failed';
          item.error = String(error);
          failed++;
          render();
          break;
        }
        render();
      }
    } finally {
      requestActive = false;
      render();
      const remaining = items.filter((item) => item.status !== 'created').length;
      if (failed) {
        dependencies.setStatus(
          `${created} created, ${failed} failed. ${remaining} item${remaining === 1 ? '' : 's'} remain for retry.`,
          'error',
        );
      } else {
        dependencies.setStatus(`${created} element${created === 1 ? '' : 's'} created.`, 'success');
      }
    }
  }

  function clear(): void {
    items = [];
    render();
  }

  function confirmTargetChange(): boolean {
    if (!items.length) {
      return true;
    }
    const shouldDiscard = window.confirm(
      'Changing the target will discard the current element queue. Continue?',
    );
    if (shouldDiscard) {
      clear();
    }
    return shouldDiscard;
  }

  function refreshAvailability(): void {
    elements.addButton.disabled = requestActive;
    elements.createButton.disabled =
      requestActive || !items.some((item) => item.status !== 'created');
    elements.clearButton.disabled = requestActive || items.length === 0;
  }

  function getItems(): QueueItem[] {
    return items.map((item) => ({ ...item, definition: { ...item.definition } }));
  }

  function render(): void {
    elements.count.textContent = `${items.length} queued`;
    elements.list.replaceChildren(
      ...items.map((item) => {
        const row = document.createElement('li');
        row.className = `queue-item ${item.status}`;
        const details = document.createElement('div');
        details.className = 'queue-item-details';
        const title = document.createElement('strong');
        title.textContent = `${item.definition.label} (${item.definition.type})`;
        const locator = document.createElement('span');
        locator.textContent = `${item.definition.locatorType}: ${item.definition.locatorString}`;
        const target = document.createElement('span');
        target.textContent = `${item.target.applicationLabel} / ${item.target.stageLabel}`;
        const status = document.createElement('span');
        status.className = 'field-feedback';
        status.textContent = item.error
          ? `Failed: ${item.error}`
          : item.status === 'creating'
            ? 'Creating...'
            : item.status;
        details.append(title, locator, target, status);
        const removeButton = document.createElement('button');
        removeButton.className = 'secondary';
        removeButton.type = 'button';
        removeButton.textContent = 'Remove';
        removeButton.disabled = requestActive;
        removeButton.addEventListener('click', () => remove(item.id));
        row.append(details, removeButton);
        return row;
      }),
    );
    refreshAvailability();
  }

  elements.addButton.addEventListener('click', addCurrent);
  elements.createButton.addEventListener('click', createAll);
  elements.clearButton.addEventListener('click', clear);
  render();

  return {
    addCurrent,
    remove,
    createAll,
    clear,
    confirmTargetChange,
    refreshAvailability,
    getItems,
  };
}

function sameTarget(left: QueueTarget, right: QueueTarget): boolean {
  return left.applicationId === right.applicationId && left.stageId === right.stageId;
}
