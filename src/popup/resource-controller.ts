import { resolveResourceLink } from './api';
import type { ApplicationResource, ElementResource, StageResource, StatusType } from './types';
import type { QueueTarget } from './queue-controller';
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
  targetSummary?: HTMLElement;
  elementTargetSummary?: HTMLElement;
}

interface ResourceControllerDependencies {
  pageSize: number;
  getAccessToken(): string | null;
  fetchAllPages<T>(baseUrl: string, pageSize: number, accessToken: string | null): Promise<T[]>;
  fetchAllPagesWithLinks<T>(
    baseUrl: string,
    pageSize: number,
    accessToken: string | null,
  ): Promise<{ items: T[]; links: Record<string, { href?: string; method?: string } | undefined> }>;
  saveSettings(): Promise<void>;
  setStatus(message: string, type?: StatusType): void;
  refreshTabAvailability(): void;
  beforeTargetChange?(): boolean;
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
  getCreateElementHref(): string | null;
  getExistingElements(): Promise<ElementResource[]>;
  getTargetContext(): QueueTarget | null;
}

export function createResourceController(
  elements: ResourceControllerElements,
  dependencies: ResourceControllerDependencies,
): ResourceController {
  let selectedApplicationId: string | null = null;
  let selectedStageId: string | null = null;
  let applicationStageCache: ApplicationStageEntry[] = [];
  let suppressTargetChangeGuard = false;

  const { trailsServiceUrlInput, applicationSelect, stageSelect, refreshResourcesButton } =
    elements;
  const { targetSummary, elementTargetSummary } = elements;

  const {
    pageSize,
    getAccessToken,
    fetchAllPages,
    fetchAllPagesWithLinks,
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
        applications.filter(hasId).map(async (application) => {
          const stagesHref = resolveResourceLink(trailsServiceUrl, application, 'stages', 'GET');
          const stages = await fetchAllPagesWithLinks<StageResource>(
            stagesHref,
            pageSize,
            accessToken,
          );
          return { application, stages: stages.items };
        }),
      );
      renderApplications();
      refreshResourcesButton.disabled = false;
    } catch (error) {
      applicationStageCache = [];
      selectedApplicationId = null;
      selectedStageId = null;
      setApplicationSelectMessage('Could not load applications');
      setStageSelectMessage('Could not load stages');
      refreshResourcesButton.disabled = false;
      renderTargetSummary();
      refreshTabAvailability();
      setStatus(readErrorMessage(error, 'Could not load applications and stages.'), 'error');
    }
  }

  function restoreSelection(applicationId: string | null, stageId: string | null): void {
    selectedApplicationId = applicationId;
    selectedStageId = stageId;
    renderTargetSummary();
  }

  function selectApplicationResource(): void {
    if (
      applicationSelect.value !== selectedApplicationId &&
      !(dependencies.beforeTargetChange?.() ?? true)
    ) {
      applicationSelect.value = selectedApplicationId ?? '';
      return;
    }
    selectedApplicationId = applicationSelect.value || null;
    suppressTargetChangeGuard = true;
    try {
      renderStagesForSelectedApplication();
    } finally {
      suppressTargetChangeGuard = false;
    }
    renderTargetSummary();
  }

  function selectStageResource(): void {
    if (
      !suppressTargetChangeGuard &&
      stageSelect.value !== selectedStageId &&
      !(dependencies.beforeTargetChange?.() ?? true)
    ) {
      stageSelect.value = selectedStageId ?? '';
      return;
    }
    selectedStageId = stageSelect.value || null;
    renderTargetSummary();
    refreshTabAvailability();
    saveSettings().catch((error) =>
      setStatus(`Could not save selected stage: ${String(error)}`, 'error'),
    );
  }

  function showTokenRequired(): void {
    setApplicationSelectMessage('Fetch a token to load applications');
    setStageSelectMessage('Select an application first');
    refreshResourcesButton.disabled = true;
    renderTargetSummary();
  }

  function clearCache(): void {
    applicationStageCache = [];
    selectedApplicationId = null;
    selectedStageId = null;
    renderTargetSummary();
  }

  function getSelectedApplicationId(): string | null {
    return selectedApplicationId;
  }

  function getSelectedStageId(): string | null {
    return selectedStageId;
  }

  function getCreateElementHref(): string | null {
    const target = getTargetContext();
    if (!target) {
      return null;
    }
    const serviceUrl = trimTrailingSlash(trailsServiceUrlInput.value);
    return `${serviceUrl}/api/applications/${target.applicationId}/stages/${target.stageId}/elements`;
  }

  function getTargetContext(): QueueTarget | null {
    const application = applicationStageCache.find(
      (entry) => String(entry.application.id) === selectedApplicationId,
    );
    const stage = application?.stages.find((candidate) => String(candidate.id) === selectedStageId);
    if (!application?.application.id || !stage?.id) {
      return null;
    }
    return {
      applicationId: String(application.application.id),
      applicationLabel:
        application.application.label ?? `Application ${application.application.id}`,
      stageId: String(stage.id),
      stageLabel: stage.label ?? `Stage ${stage.id}`,
    };
  }

  async function getExistingElements(): Promise<ElementResource[]> {
    const application = applicationStageCache.find(
      (entry) => String(entry.application.id) === selectedApplicationId,
    );
    const stage = application?.stages.find((candidate) => String(candidate.id) === selectedStageId);
    if (!stage) {
      return [];
    }
    let elementsHref: string;
    try {
      elementsHref = resolveResourceLink(
        trimTrailingSlash(trailsServiceUrlInput.value),
        stage,
        'elements',
        'GET',
      );
    } catch (error) {
      if (String(error).includes('is unavailable')) {
        return [];
      }
      throw error;
    }
    return fetchAllPages<ElementResource>(elementsHref, pageSize, getAccessToken());
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
      renderTargetSummary();
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
      renderTargetSummary();
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

  function renderTargetSummary(): void {
    const selectedApplication = applicationStageCache.find(
      (entry) => String(entry.application.id) === selectedApplicationId,
    );
    const selectedStage = selectedApplication?.stages.find(
      (stage) => String(stage.id) === selectedStageId,
    );
    const applicationLabel = selectedApplication?.application.label ?? selectedApplicationId;
    const stageLabel = selectedStage?.label ?? selectedStageId;
    const summary =
      applicationLabel && stageLabel
        ? `Target: ${applicationLabel} / ${stageLabel}`
        : 'Choose application and stage.';
    if (targetSummary) {
      targetSummary.textContent = summary;
    }
    if (elementTargetSummary) {
      elementTargetSummary.textContent = summary;
    }
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
    getCreateElementHref,
    getExistingElements,
    getTargetContext,
  };
}
