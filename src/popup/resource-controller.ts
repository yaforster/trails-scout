import type { ApplicationResource, StageResource, StatusType } from './types';
import { hasId, readErrorMessage, trimTrailingSlash } from './utils';

export interface ApplicationStageEntry {
  application: ApplicationResource;
  stages: StageResource[];
}

interface ResourceControllerElements {
  trailsServiceUrlInput: HTMLInputElement;
  applicationSelect: HTMLSelectElement;
  stageSelect: HTMLSelectElement;
  refreshResourcesButton: HTMLButtonElement;
}

interface ResourceControllerDependencies {
  pageSize: number;
  getAccessToken(): string | null;
  fetchAllPages<T>(baseUrl: string, pageSize: number, accessToken: string | null): Promise<T[]>;
  saveSettings(): Promise<void>;
  setStatus(message: string, type?: StatusType): void;
  refreshTabAvailability(): void;
}

export interface ResourceController {
  loadApplicationStages(): Promise<void>;
  restoreSelection(applicationId: string | null, stageId: string | null): void;
  selectApplicationResource(): void;
  selectStageResource(): void;
  showTokenRequired(): void;
  clearCache(): void;
  getSelectedApplicationId(): string | null;
  getSelectedStageId(): string | null;
}

export function createResourceController(
  elements: ResourceControllerElements,
  dependencies: ResourceControllerDependencies,
): ResourceController {
  let selectedApplicationId: string | null = null;
  let selectedStageId: string | null = null;
  let applicationStageCache: ApplicationStageEntry[] = [];

  const { trailsServiceUrlInput, applicationSelect, stageSelect, refreshResourcesButton } =
    elements;

  const {
    pageSize,
    getAccessToken,
    fetchAllPages,
    saveSettings,
    setStatus,
    refreshTabAvailability,
  } = dependencies;

  async function loadApplicationStages(): Promise<void> {
    const accessToken = getAccessToken();
    if (!accessToken) {
      showTokenRequired();
      refreshTabAvailability();
      return;
    }

    const trailsServiceUrl = trimTrailingSlash(trailsServiceUrlInput.value);
    if (!trailsServiceUrl) {
      setApplicationSelectMessage('Set Trails service URL first');
      setStageSelectMessage('Select an application first');
      return;
    }

    refreshResourcesButton.disabled = true;
    setApplicationSelectMessage('Loading applications...');
    setStageSelectMessage('Loading stages...');

    try {
      const applications = await fetchAllPages<ApplicationResource>(
        `${trailsServiceUrl}/api/applications?includeRetired=false`,
        pageSize,
        accessToken,
      );
      applicationStageCache = await Promise.all(
        applications.filter(hasId).map(async (application) => ({
          application,
          stages: await fetchAllPages<StageResource>(
            `${trailsServiceUrl}/api/applications/${application.id}/stages?includeRetired=false`,
            pageSize,
            accessToken,
          ),
        })),
      );
      renderApplications();
      refreshResourcesButton.disabled = false;
    } catch (error) {
      setApplicationSelectMessage('Could not load applications');
      setStageSelectMessage('Could not load stages');
      refreshResourcesButton.disabled = false;
      setStatus(readErrorMessage(error, 'Could not load applications and stages.'), 'error');
    }
  }

  function restoreSelection(applicationId: string | null, stageId: string | null): void {
    selectedApplicationId = applicationId;
    selectedStageId = stageId;
  }

  function selectApplicationResource(): void {
    selectedApplicationId = applicationSelect.value || null;
    renderStagesForSelectedApplication();
  }

  function selectStageResource(): void {
    selectedStageId = stageSelect.value || null;
    refreshTabAvailability();
    saveSettings().catch((error) =>
      setStatus(`Could not save selected stage: ${String(error)}`, 'error'),
    );
  }

  function showTokenRequired(): void {
    setApplicationSelectMessage('Fetch a token to load applications');
    setStageSelectMessage('Select an application first');
    refreshResourcesButton.disabled = true;
  }

  function clearCache(): void {
    applicationStageCache = [];
  }

  function getSelectedApplicationId(): string | null {
    return selectedApplicationId;
  }

  function getSelectedStageId(): string | null {
    return selectedStageId;
  }

  function renderApplications(): void {
    applicationSelect.replaceChildren();

    let selectedValueExists = false;
    for (const applicationStage of applicationStageCache) {
      const stages = applicationStage.stages.filter(hasId);
      if (stages.length === 0 || applicationStage.application.id === undefined) {
        continue;
      }

      const value = String(applicationStage.application.id);
      const option = document.createElement('option');
      option.value = value;
      option.textContent =
        applicationStage.application.label ?? `Application ${applicationStage.application.id}`;
      applicationSelect.appendChild(option);
      selectedValueExists = selectedValueExists || value === selectedApplicationId;
    }

    if (applicationSelect.options.length === 0) {
      selectedApplicationId = null;
      selectedStageId = null;
      setApplicationSelectMessage('No applications with stages found');
      setStageSelectMessage('Select an application first');
      refreshTabAvailability();
      return;
    }

    applicationSelect.disabled = false;
    applicationSelect.value = selectedValueExists
      ? (selectedApplicationId ?? applicationSelect.options[0].value)
      : applicationSelect.options[0].value;
    selectApplicationResource();
  }

  function renderStagesForSelectedApplication(): void {
    stageSelect.replaceChildren();
    const applicationId = Number(selectedApplicationId);
    const selectedApplication = applicationStageCache.find(
      (entry) => entry.application.id === applicationId,
    );
    const stages = selectedApplication?.stages.filter(hasId) ?? [];

    if (!selectedApplicationId || stages.length === 0) {
      selectedStageId = null;
      setStageSelectMessage('No stages available');
      refreshTabAvailability();
      saveSettings().catch((error) =>
        setStatus(`Could not save selected application: ${String(error)}`, 'error'),
      );
      return;
    }

    let selectedValueExists = false;
    for (const stage of stages) {
      const value = String(stage.id);
      const option = document.createElement('option');
      option.value = value;
      option.textContent = stage.label ?? `Stage ${stage.id}`;
      stageSelect.appendChild(option);
      selectedValueExists = selectedValueExists || value === selectedStageId;
    }

    stageSelect.disabled = false;
    stageSelect.value = selectedValueExists
      ? (selectedStageId ?? stageSelect.options[0].value)
      : stageSelect.options[0].value;
    selectStageResource();
  }

  function setApplicationSelectMessage(message: string): void {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = message;
    applicationSelect.replaceChildren(option);
    applicationSelect.disabled = true;
  }

  function setStageSelectMessage(message: string): void {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = message;
    stageSelect.replaceChildren(option);
    stageSelect.disabled = true;
  }

  return {
    loadApplicationStages,
    restoreSelection,
    selectApplicationResource,
    selectStageResource,
    showTokenRequired,
    clearCache,
    getSelectedApplicationId,
    getSelectedStageId,
  };
}
