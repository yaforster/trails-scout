type ChromeSidePanel = {
  setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void>;
};

const chromeSidePanel = (globalThis as unknown as { chrome: { sidePanel: ChromeSidePanel } }).chrome
  .sidePanel;

void chromeSidePanel.setPanelBehavior({ openPanelOnActionClick: true });
