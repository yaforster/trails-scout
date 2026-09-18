import browser from 'webextension-polyfill';
import { injectedInspector } from './injected-inspector';
import type { LocatorType, StatusType } from './types';
import type { LocatorValidationResult } from '../locator-selectors';
import { getActiveTab, readErrorMessage } from './utils';

type SetStatus = (message: string, type?: StatusType) => void;

export async function startLocatorPicker(
  startInspectorButton: HTMLButtonElement,
  setStatus: SetStatus,
): Promise<void> {
  const tab = await getActiveTab();
  if (!tab.id) {
    setStatus('No active tab is available.', 'error');
    startInspectorButton.focus();
    return;
  }

  if (!canInspectTab(tab)) {
    setStatus('Open an http or https page before picking a locator.', 'error');
    startInspectorButton.focus();
    return;
  }

  startInspectorButton.disabled = true;

  try {
    await sendStartInspectorMessage(tab.id);
    setStatus('Picker active: click page element. Escape cancels.');
  } catch (error) {
    const message = readErrorMessage(error, 'Could not start locator picker.');
    setStatus(message, 'error');
    startInspectorButton.focus();
  } finally {
    startInspectorButton.disabled = false;
  }
}

export async function validateLocator(
  locatorType: LocatorType,
  locatorString: string,
): Promise<LocatorValidationResult> {
  const tab = await getActiveTab();
  if (!tab.id) {
    throw new Error('No active tab is available.');
  }
  if (!canInspectTab(tab)) {
    throw new Error('Open an http or https page before validating a locator.');
  }

  const request = {
    type: 'TRAILS_VALIDATE_LOCATOR' as const,
    requestId: `${Date.now()}-${Math.random()}`,
    locatorType,
    locatorString,
  };

  try {
    const result = await browser.tabs.sendMessage(tab.id, request);
    if (isValidationResult(result, request.requestId)) {
      return result;
    }
    throw new Error('Page returned an invalid locator validation result.');
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectedInspector,
      args: [request],
    });
    const result = results[0]?.result;
    if (!isValidationResult(result, request.requestId)) {
      throw new Error('Page returned an invalid locator validation result.');
    }
    return result;
  }
}

async function sendStartInspectorMessage(tabId: number): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, { type: 'TRAILS_START_INSPECTOR' });
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    await startInjectedInspector(tabId);
  }
}

async function startInjectedInspector(tabId: number): Promise<void> {
  try {
    // Chrome serializes func; injected inspector cannot import popup modules here.
    await chrome.scripting.executeScript({
      target: { tabId },
      func: injectedInspector,
    });
  } catch (error) {
    throw new Error(readErrorMessage(error, 'Could not inject locator picker into this page.'));
  }
}

function canInspectTab(tab: browser.Tabs.Tab): boolean {
  return Boolean(tab.url?.startsWith('http://') || tab.url?.startsWith('https://'));
}

function isMissingReceiverError(error: unknown): boolean {
  return String(error).includes('Receiving end does not exist');
}

function isValidationResult(value: unknown, requestId: string): value is LocatorValidationResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).type === 'TRAILS_LOCATOR_VALIDATED' &&
    (value as Record<string, unknown>).requestId === requestId
  );
}
