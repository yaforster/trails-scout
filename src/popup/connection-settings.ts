import browser from 'webextension-polyfill';
import type { PopupSettings } from './types';
import { storageGet } from './utils';

interface ConnectionSettingsElements {
  trailsServiceUrlInput: HTMLInputElement;
  keycloakUrlInput: HTMLInputElement;
  clientIdInput: HTMLInputElement;
  clientSecretInput: HTMLInputElement;
}

export function createConnectionSettings(
  elements: ConnectionSettingsElements,
  dependencies: {
    getSelectedApplicationId(): string | null;
    getSelectedStageId(): string | null;
    restoreSelection(applicationId: string | null, stageId: string | null): void;
    restoreToken(settings: PopupSettings): void;
  },
) {
  async function restore(): Promise<PopupSettings> {
    const settings = await storageGet<PopupSettings>([
      'trailsServiceUrl',
      'keycloakUrl',
      'clientId',
      'clientSecret',
      'selectedApplicationId',
      'selectedStageId',
      'accessToken',
      'refreshToken',
      'accessTokenExpiresAt',
      'refreshTokenExpiresAt',
    ]);

    elements.trailsServiceUrlInput.value =
      settings.trailsServiceUrl ?? elements.trailsServiceUrlInput.value;
    elements.keycloakUrlInput.value = settings.keycloakUrl ?? elements.keycloakUrlInput.value;
    elements.clientIdInput.value = settings.clientId ?? elements.clientIdInput.value;
    elements.clientSecretInput.value = settings.clientSecret ?? '';
    dependencies.restoreSelection(
      settings.selectedApplicationId ?? null,
      settings.selectedStageId ?? null,
    );
    dependencies.restoreToken(settings);
    return settings;
  }

  function save(): Promise<void> {
    return browser.storage.local.set({
      trailsServiceUrl: elements.trailsServiceUrlInput.value.trim(),
      keycloakUrl: elements.keycloakUrlInput.value.trim(),
      clientId: elements.clientIdInput.value.trim(),
      clientSecret: elements.clientSecretInput.value,
      selectedApplicationId: dependencies.getSelectedApplicationId(),
      selectedStageId: dependencies.getSelectedStageId(),
    });
  }

  return { restore, save };
}
