import type { TabId } from './types';

interface TabElements {
  authTab: HTMLButtonElement;
  targetTab: HTMLButtonElement;
  elementTab: HTMLButtonElement;
  authPanel: HTMLElement;
  targetPanel: HTMLElement;
  elementPanel: HTMLElement;
}

export interface TabController {
  activate(tabId: TabId): void;
  restore(tabId: TabId): void;
  refreshAvailability(): void;
}

export function createTabController(
  elements: TabElements,
  isTargetEnabled: () => boolean,
  isElementEnabled: () => boolean,
  persistTab?: (tabId: TabId) => void,
): TabController {
  let activeTab: TabId = 'auth';
  const { authTab, targetTab, elementTab, authPanel, targetPanel, elementPanel } = elements;

  authTab.addEventListener('click', () => activate('auth'));
  targetTab.addEventListener('click', () => activate('target'));
  elementTab.addEventListener('click', () => activate('element'));

  function refreshAvailability(): void {
    const targetEnabled = isTargetEnabled();
    const elementEnabled = isElementEnabled();

    setTabEnabled(targetTab, targetEnabled);
    setTabEnabled(elementTab, elementEnabled);

    if (activeTab === 'target' && !targetEnabled) {
      activate('auth');
      return;
    }

    if (activeTab === 'element' && !elementEnabled) {
      activate(targetEnabled ? 'target' : 'auth');
    }
  }

  function activate(tabId: TabId): void {
    activateTab(tabId, true);
  }

  function restore(tabId: TabId): void {
    activateTab(tabId, false);
  }

  function activateTab(tabId: TabId, persist: boolean): void {
    if (persist && tabId === 'target' && !isTargetEnabled()) {
      return;
    }

    if (persist && tabId === 'element' && !isElementEnabled()) {
      return;
    }

    activeTab = tabId;
    if (persist) {
      persistTab?.(tabId);
    }

    const tabs: Record<TabId, HTMLButtonElement> = {
      auth: authTab,
      target: targetTab,
      element: elementTab,
    };
    const panels: Record<TabId, HTMLElement> = {
      auth: authPanel,
      target: targetPanel,
      element: elementPanel,
    };

    for (const [id, tab] of Object.entries(tabs) as Array<[TabId, HTMLButtonElement]>) {
      const isActive = id === tabId;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      panels[id].classList.toggle('active', isActive);
      panels[id].hidden = !isActive;
    }
  }

  return { activate, restore, refreshAvailability };
}

function setTabEnabled(tab: HTMLButtonElement, enabled: boolean): void {
  tab.disabled = !enabled;
  tab.setAttribute('aria-disabled', String(!enabled));
}
