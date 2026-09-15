import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createResourceController } from './resource-controller';

vi.mock('webextension-polyfill', () => ({ default: {} }));

function createHarness(accessToken: string | null = 'access-token') {
  document.body.innerHTML = `
        <input id="trailsServiceUrl" value=" http://localhost:8080/ " />
        <select id="applicationSelect"></select>
        <select id="stageSelect"></select>
        <button id="refreshResourcesButton"></button>
    `;

  const applicationSelect = document.getElementById('applicationSelect') as HTMLSelectElement;
  const stageSelect = document.getElementById('stageSelect') as HTMLSelectElement;
  const refreshResourcesButton = document.getElementById(
    'refreshResourcesButton',
  ) as HTMLButtonElement;
  const fetchAllPages = vi.fn(async <T>(url: string): Promise<T[]> => {
    if (url.includes('/api/applications/1/stages')) {
      return [{ id: 10, label: 'Production' }] as T[];
    }

    if (url.includes('/api/applications/2/stages')) {
      return [{ id: 20, label: 'Staging' }] as T[];
    }

    return [{ id: 1, label: 'Shop' }, { id: 2, label: 'Checkout' }, { label: 'Missing id' }] as T[];
  });
  const saveSettings = vi.fn().mockResolvedValue(undefined);
  const setStatus = vi.fn();
  const refreshTabAvailability = vi.fn();
  const controller = createResourceController(
    {
      trailsServiceUrlInput: document.getElementById('trailsServiceUrl') as HTMLInputElement,
      applicationSelect,
      stageSelect,
      refreshResourcesButton,
    },
    {
      pageSize: 50,
      getAccessToken: () => accessToken,
      fetchAllPages,
      saveSettings,
      setStatus,
      refreshTabAvailability,
    },
  );

  return {
    applicationSelect,
    controller,
    fetchAllPages,
    refreshResourcesButton,
    refreshTabAvailability,
    saveSettings,
    setStatus,
    stageSelect,
  };
}

describe('resource controller', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shows a token-required state when resources are loaded without a token', async () => {
    const {
      applicationSelect,
      controller,
      refreshResourcesButton,
      refreshTabAvailability,
      stageSelect,
    } = createHarness(null);

    await controller.loadApplicationStages();

    expect(applicationSelect.disabled).toBe(true);
    expect(applicationSelect.value).toBe('');
    expect(applicationSelect.options[0].textContent).toBe('Fetch a token to load applications');
    expect(stageSelect.options[0].textContent).toBe('Select an application first');
    expect(refreshResourcesButton.disabled).toBe(true);
    expect(refreshTabAvailability).toHaveBeenCalled();
  });

  it('loads applications and stages into selectable controls', async () => {
    const { applicationSelect, controller, fetchAllPages, saveSettings, stageSelect } =
      createHarness();

    await controller.loadApplicationStages();

    expect(fetchAllPages).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8080/api/applications?includeRetired=false',
      50,
      'access-token',
    );
    expect(applicationSelect.disabled).toBe(false);
    expect([...applicationSelect.options].map((option) => option.textContent)).toEqual([
      'Shop',
      'Checkout',
    ]);
    expect(applicationSelect.value).toBe('1');
    expect(stageSelect.disabled).toBe(false);
    expect(stageSelect.value).toBe('10');
    expect(controller.getSelectedApplicationId()).toBe('1');
    expect(controller.getSelectedStageId()).toBe('10');
    expect(saveSettings).toHaveBeenCalled();
  });

  it('keeps restored selections when they still exist in the loaded resources', async () => {
    const { applicationSelect, controller, stageSelect } = createHarness();
    controller.restoreSelection('2', '20');

    await controller.loadApplicationStages();

    expect(applicationSelect.value).toBe('2');
    expect(stageSelect.value).toBe('20');
    expect(controller.getSelectedApplicationId()).toBe('2');
    expect(controller.getSelectedStageId()).toBe('20');
  });

  it('updates stages when the selected application changes', async () => {
    const { applicationSelect, controller, stageSelect } = createHarness();
    await controller.loadApplicationStages();

    applicationSelect.value = '2';
    controller.selectApplicationResource();

    expect(stageSelect.value).toBe('20');
    expect([...stageSelect.options].map((option) => option.textContent)).toEqual(['Staging']);
    expect(controller.getSelectedApplicationId()).toBe('2');
  });

  it('reports load failures and restores the refresh button', async () => {
    const {
      applicationSelect,
      controller,
      fetchAllPages,
      refreshResourcesButton,
      setStatus,
      stageSelect,
    } = createHarness();
    fetchAllPages.mockRejectedValueOnce(new Error('Applications unavailable.'));

    await controller.loadApplicationStages();

    expect(applicationSelect.options[0].textContent).toBe('Could not load applications');
    expect(stageSelect.options[0].textContent).toBe('Could not load stages');
    expect(refreshResourcesButton.disabled).toBe(false);
    expect(setStatus).toHaveBeenCalledWith('Applications unavailable.', 'error');
  });
});
