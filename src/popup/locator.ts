import browser from 'webextension-polyfill';
import { injectedInspector } from './injected-inspector';
import type { StatusType } from './types';
import { getActiveTab, readErrorMessage } from './utils';

type SetStatus = (message: string, type?: StatusType) => void;

export async function startLocatorPicker(
  startInspectorButton: HTMLButtonElement,
  setStatus: SetStatus,
): Promise<void> {
  const tab = await getActiveTab();
  if (!tab.id) {
    setStatus('No active tab is available.', 'error');
    return;
  }

  if (!canInspectTab(tab)) {
    setStatus('Open an http or https page before picking a locator.', 'error');
    return;
  }

  startInspectorButton.disabled = true;

  try {
    await sendStartInspectorMessage(tab.id);
    setStatus('Click an element in the page. Press Escape to cancel.');
  } catch (error) {
    const message = readErrorMessage(error, 'Could not start locator picker.');
    setStatus(message, 'error');
  } finally {
    startInspectorButton.disabled = false;
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
