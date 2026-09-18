import { testHealthEndpoint } from './api';
import { trimTrailingSlash } from './utils';

interface ConnectionHealthElements {
  trailsServiceUrlInput: HTMLInputElement;
  testTrailsConnectionButton: HTMLButtonElement;
  trailsConnectionFeedback: HTMLDivElement;
}

export function createConnectionHealth(
  elements: ConnectionHealthElements,
  dependencies: {
    getAccessToken(): string | null;
    saveSettings(): Promise<void>;
    setStatus(message: string, type?: 'success' | 'error' | 'idle'): void;
  },
): { test(): Promise<void>; clear(): void } {
  const { trailsServiceUrlInput, testTrailsConnectionButton, trailsConnectionFeedback } = elements;

  async function test(): Promise<void> {
    const trailsServiceUrl = trimTrailingSlash(trailsServiceUrlInput.value);
    if (!trailsServiceUrl) {
      setState('error', 'Trails service URL is required.');
      dependencies.setStatus('Trails service URL is required.', 'error');
      return;
    }

    testTrailsConnectionButton.disabled = true;
    setState('pending', 'Testing connection...');
    dependencies.setStatus('Testing Trails service connection...');

    try {
      const response = await testHealthEndpoint(trailsServiceUrl, dependencies.getAccessToken());
      if (!response.ok) {
        setState('error', `Connection failed: HTTP ${response.status}.`);
        dependencies.setStatus(`Trails service responded with HTTP ${response.status}.`, 'error');
        return;
      }

      setState('success', 'Connection succeeded.');
      dependencies.setStatus('Trails service connection succeeded.', 'success');
      await dependencies.saveSettings();
    } catch {
      setState('error', 'Connection failed.');
      dependencies.setStatus('Trails service connection failed.', 'error');
    } finally {
      testTrailsConnectionButton.disabled = false;
    }
  }

  function clear(): void {
    setState(null, '');
  }

  function setState(type: 'success' | 'error' | 'pending' | null, message: string): void {
    trailsServiceUrlInput.classList.toggle('connection-success', type === 'success');
    trailsServiceUrlInput.classList.toggle('connection-error', type === 'error');
    trailsConnectionFeedback.className = `field-feedback ${type ?? ''}`;
    trailsConnectionFeedback.textContent = message;
  }

  return { test, clear };
}
