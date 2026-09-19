import browser from 'webextension-polyfill';
import {
  createSelectedElement,
  isInspectorMessage,
  isResolveLocatorBoundsMessage,
  isValidateLocatorMessage,
  resolveLocatorBoundsInDocument,
  toSelectedElementMessage,
  validateLocatorInDocument,
} from './locator-selectors';

let inspectorActive = false;
let hoveredElement: Element | null = null;
let overlay: HTMLDivElement | null = null;

browser.runtime.onMessage.addListener((message: unknown) => {
  if (isValidateLocatorMessage(message)) {
    return Promise.resolve(validateLocatorInDocument(message));
  }
  if (isResolveLocatorBoundsMessage(message)) {
    return Promise.resolve().then(() => resolveLocatorBoundsInDocument(message));
  }
  if (isInspectorMessage(message)) {
    startInspector();
  }
});

function startInspector(): void {
  if (inspectorActive) {
    return;
  }

  inspectorActive = true;
  createOverlay();

  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
}

function stopInspector(): void {
  inspectorActive = false;
  hoveredElement = null;

  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);

  overlay?.remove();
  overlay = null;
}

function createOverlay(): void {
  overlay?.remove();

  overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '2147483647';
  overlay.style.border = '2px solid #16a34a';
  overlay.style.background = 'rgba(22, 163, 74, 0.12)';
  overlay.style.boxSizing = 'border-box';
  overlay.style.borderRadius = '4px';
  overlay.style.display = 'none';

  document.documentElement.appendChild(overlay);
}

function handleMouseOver(event: MouseEvent): void {
  if (!inspectorActive || !(event.target instanceof Element)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  hoveredElement = event.target;
  updateOverlay(hoveredElement);
}

function handleMouseMove(event: MouseEvent): void {
  if (!inspectorActive || !hoveredElement) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  updateOverlay(hoveredElement);
}

function handleClick(event: MouseEvent): void {
  if (!inspectorActive || !hoveredElement) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const selectedElement = createSelectedElement(hoveredElement);

  browser.storage.local.set({ lastSelectedElement: selectedElement });
  browser.runtime.sendMessage(toSelectedElementMessage(selectedElement)).catch(() => undefined);
  writeToClipboard(
    selectedElement.candidates.find((candidate) => candidate.locatorType === 'CSS')
      ?.locatorString ?? '',
  );
  stopInspector();
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    browser.runtime.sendMessage({ type: 'TRAILS_INSPECTOR_CANCELLED' }).catch(() => undefined);
    stopInspector();
  }
}

function updateOverlay(element: Element): void {
  if (!overlay) {
    return;
  }

  const rect = element.getBoundingClientRect();
  overlay.style.display = 'block';
  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
}

function writeToClipboard(value: string): void {
  navigator.clipboard?.writeText(value).catch(() => undefined);
}

export {};
