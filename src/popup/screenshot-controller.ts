import browser from 'webextension-polyfill';
import type { LocatorBoundsResult } from '../locator-selectors';
import type { LocatorType } from './types';

export interface ScreenshotState {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
}

interface ScreenshotControllerElements {
  captureButton: HTMLButtonElement;
  replaceButton: HTMLButtonElement;
  removeButton: HTMLButtonElement;
  preview: HTMLImageElement;
  details: HTMLElement;
  feedback: HTMLElement;
}

interface ScreenshotControllerDependencies {
  getLocator(): { locatorType: LocatorType; locatorString: string } | null;
  getLocatorBounds(locatorType: LocatorType, locatorString: string): Promise<LocatorBoundsResult>;
}

export interface ScreenshotController {
  capture(): Promise<void>;
  replace(): Promise<void>;
  remove(): void;
  getState(): ScreenshotState | null;
  clear(): void;
}

export function createScreenshotController(
  elements: ScreenshotControllerElements,
  setStatus: (message: string, type?: 'idle' | 'success' | 'error') => void,
  dependencies: ScreenshotControllerDependencies,
): ScreenshotController {
  let state: ScreenshotState | null = null;

  async function capture(): Promise<void> {
    elements.captureButton.disabled = true;
    try {
      const locator = dependencies.getLocator();
      if (!locator) {
        throw new Error('Select and validate a locator before capturing a screenshot.');
      }
      const bounds = await dependencies.getLocatorBounds(
        locator.locatorType,
        locator.locatorString,
      );
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id || !isCaptureableUrl(tab.url)) {
        throw new Error('Screenshot capture requires an active http or https tab.');
      }

      const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      const fullBlob = await (await fetch(dataUrl)).blob();
      const bitmap = await createImageBitmap(fullBlob);
      try {
        const blob = await cropBitmapToBlob(bitmap, bounds);
        replaceState({
          blob,
          previewUrl: URL.createObjectURL(blob),
          width: Math.ceil(cropWidth(bounds) * (bitmap.width / bounds.viewportWidth)),
          height: Math.ceil(cropHeight(bounds) * (bitmap.height / bounds.viewportHeight)),
        });
      } finally {
        bitmap.close();
      }
      setStatus(
        'Element screenshot captured. Visible tab content may contain sensitive data.',
        'success',
      );
    } catch (error) {
      setFeedback(String(error), 'error');
      setStatus('Screenshot not captured.', 'error');
    } finally {
      elements.captureButton.disabled = false;
    }
  }

  async function replace(): Promise<void> {
    await capture();
  }

  function remove(): void {
    clear();
    setFeedback('Screenshot removed.', 'success');
  }

  function clear(): void {
    if (state) {
      URL.revokeObjectURL(state.previewUrl);
    }
    state = null;
    elements.preview.hidden = true;
    elements.preview.removeAttribute('src');
    elements.details.textContent = '';
    elements.removeButton.disabled = true;
    elements.replaceButton.disabled = false;
  }

  function replaceState(nextState: ScreenshotState): void {
    clear();
    state = nextState;
    elements.preview.src = nextState.previewUrl;
    elements.preview.hidden = false;
    elements.details.textContent = `${nextState.width} x ${nextState.height}px`;
    elements.removeButton.disabled = false;
    setFeedback('Screenshot ready for upload.', 'success');
  }

  function setFeedback(message: string, type: 'success' | 'error'): void {
    elements.feedback.textContent = message;
    elements.feedback.className = `field-feedback ${type}`;
  }

  clear();
  window.addEventListener('pagehide', clear, { once: true });

  return { capture, replace, remove, getState: () => state, clear };
}

export async function cropBitmapToBlob(
  bitmap: ImageBitmap,
  bounds: LocatorBoundsResult,
  padding = 24,
): Promise<Blob> {
  const scaleX = bitmap.width / bounds.viewportWidth;
  const scaleY = bitmap.height / bounds.viewportHeight;
  const sourceLeft = Math.max(0, bounds.left - padding) * scaleX;
  const sourceTop = Math.max(0, bounds.top - padding) * scaleY;
  const sourceRight = Math.min(bounds.viewportWidth, bounds.left + bounds.width + padding) * scaleX;
  const sourceBottom =
    Math.min(bounds.viewportHeight, bounds.top + bounds.height + padding) * scaleY;
  const width = Math.max(1, Math.ceil(sourceRight - sourceLeft));
  const height = Math.max(1, Math.ceil(sourceBottom - sourceTop));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Screenshot cropping is unavailable.');
  }
  context.drawImage(bitmap, sourceLeft, sourceTop, width, height, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Could not encode cropped screenshot.'));
      }
    }, 'image/png');
  });
}

function cropWidth(bounds: LocatorBoundsResult, padding = 24): number {
  return (
    Math.min(bounds.viewportWidth, bounds.left + bounds.width + padding) -
    Math.max(0, bounds.left - padding)
  );
}

function cropHeight(bounds: LocatorBoundsResult, padding = 24): number {
  return (
    Math.min(bounds.viewportHeight, bounds.top + bounds.height + padding) -
    Math.max(0, bounds.top - padding)
  );
}

function isCaptureableUrl(url: string | undefined): boolean {
  return Boolean(url && /^https?:\/\//i.test(url));
}
