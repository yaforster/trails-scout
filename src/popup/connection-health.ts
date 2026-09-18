import { testHealthEndpoint } from './api';
import { trimTrailingSlash } from './utils';

interface ConnectionHealthElements {
  trailsServiceUrlInput: HTMLInputElement;
  testTrailsConnectionButton: HTMLButtonElement;
}

export function createConnectionHealth(
  elements: ConnectionHealthElements,
  dependencies: {
    getAccessToken(): string | null;
    saveSettings(): Promise<void>;
    setStatus(message: string, type?: 'success' | 'error' | 'idle'): void;
  },
): { test(): Promise<void>; clear(): void } {
  const { trailsServiceUrlInput, testTrailsConnectionButton } = elements;

  async function test(): Promise<void> {
    const trailsServiceUrl = trimTrailingSlash(trailsServiceUrlInput.value);
    if (!trailsServiceUrl) {
      setState('error');
      dependencies.setStatus('Trails service URL is required.', 'error');
      return;
    }

    testTrailsConnectionButton.disabled = true;
    dependencies.setStatus('Testing Trails service connection...');

    try {
      const response = await testHealthEndpoint(trailsServiceUrl, dependencies.getAccessToken());
      if (!response.ok) {
        setState('error');
        dependencies.setStatus(`Trails service responded with HTTP ${response.status}.`, 'error');
        return;
      }

      setState('success');
      dependencies.setStatus('Trails service connection succeeded.', 'success');
      await dependencies.saveSettings();
    } catch {
      setState('error');
      dependencies.setStatus('Trails service connection failed.', 'error');
    } finally {
      testTrailsConnectionButton.disabled = false;
    }
  }

  function clear(): void {
    setState(null);
  }

  function setState(type: 'success' | 'error' | null): void {
    trailsServiceUrlInput.classList.toggle('connection-success', type === 'success');
    trailsServiceUrlInput.classList.toggle('connection-error', type === 'error');
  }

  return { test, clear };
}
