interface SettingsMenuElements {
  settingsMenuContainer: HTMLDivElement;
  settingsButton: HTMLButtonElement;
  settingsMenu: HTMLDivElement;
  deleteTokenButton: HTMLButtonElement;
}

export interface SettingsMenuController {
  setOpen(open: boolean): void;
}

export function createSettingsMenu(
  elements: SettingsMenuElements,
  onDeleteToken: () => void | Promise<void>,
): SettingsMenuController {
  const { settingsMenuContainer, settingsButton, settingsMenu, deleteTokenButton } = elements;

  settingsButton.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(settingsMenu.hidden);
  });
  deleteTokenButton.addEventListener('click', () => {
    void onDeleteToken();
  });
  document.addEventListener('click', (event) => {
    if (settingsMenu.hidden || settingsMenuContainer.contains(event.target as Node)) {
      return;
    }

    setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  });

  function setOpen(open: boolean): void {
    settingsMenu.hidden = !open;
    settingsButton.setAttribute('aria-expanded', String(open));
  }

  return { setOpen };
}
