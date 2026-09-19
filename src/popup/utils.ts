import browser from 'webextension-polyfill';
import type { SelectedElementMessage } from '../locator-selectors';

export async function getActiveTab(): Promise<browser.Tabs.Tab> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

export function readErrorMessage(result: unknown, fallback: string): string {
  if (isRecord(result)) {
    const detail = result.detail ?? result.message ?? result.error_description ?? result.error;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
  }

  return fallback;
}

export function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/$/, '');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function hasId<T extends { id?: number }>(value: T): value is T & { id: number } {
  return value.id !== undefined;
}

export function isSelectedLocatorMessage(message: unknown): message is SelectedElementMessage {
  return (
    isRecord(message) &&
    message.type === 'TRAILS_ELEMENT_SELECTED' &&
    Array.isArray(message.candidates) &&
    message.candidates.length > 0 &&
    message.candidates.every(
      (candidate) =>
        isRecord(candidate) &&
        (candidate.locatorType === 'CSS' || candidate.locatorType === 'XPATH') &&
        typeof candidate.locatorString === 'string' &&
        typeof candidate.strategy === 'string',
    )
  );
}

export function isLocatorCancelledMessage(message: unknown): boolean {
  return isRecord(message) && message.type === 'TRAILS_INSPECTOR_CANCELLED';
}

export function storageGet<T>(keys: string | string[]): Promise<T> {
  return browser.storage.local.get(keys) as Promise<T>;
}
