import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSettingsMenu } from './settings-menu';

function button(id: string): HTMLButtonElement {
  return document.getElementById(id) as HTMLButtonElement;
}

function div(id: string): HTMLDivElement {
  return document.getElementById(id) as HTMLDivElement;
}

function renderSettingsMenu(): void {
  document.body.innerHTML = `
        <div id="settingsMenuContainer">
            <button id="settingsButton" aria-expanded="false"></button>
            <div id="settingsMenu" hidden>
                <button id="deleteTokenButton"></button>
            </div>
        </div>
        <button id="outsideButton"></button>
    `;
}

describe('settings menu', () => {
  beforeEach(() => {
    renderSettingsMenu();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens when the settings button is clicked', () => {
    createSettingsMenu(
      {
        settingsMenuContainer: div('settingsMenuContainer'),
        settingsButton: button('settingsButton'),
        settingsMenu: div('settingsMenu'),
        deleteTokenButton: button('deleteTokenButton'),
      },
      vi.fn(),
    );

    button('settingsButton').click();

    expect(div('settingsMenu').hidden).toBe(false);
    expect(button('settingsButton').getAttribute('aria-expanded')).toBe('true');
  });

  it('closes when Escape is pressed', () => {
    const controller = createSettingsMenu(
      {
        settingsMenuContainer: div('settingsMenuContainer'),
        settingsButton: button('settingsButton'),
        settingsMenu: div('settingsMenu'),
        deleteTokenButton: button('deleteTokenButton'),
      },
      vi.fn(),
    );
    controller.setOpen(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(div('settingsMenu').hidden).toBe(true);
  });

  it('closes when clicking outside the settings menu', () => {
    const controller = createSettingsMenu(
      {
        settingsMenuContainer: div('settingsMenuContainer'),
        settingsButton: button('settingsButton'),
        settingsMenu: div('settingsMenu'),
        deleteTokenButton: button('deleteTokenButton'),
      },
      vi.fn(),
    );
    controller.setOpen(true);

    button('outsideButton').click();

    expect(div('settingsMenu').hidden).toBe(true);
  });

  it('does not close when clicking inside the settings menu', () => {
    const controller = createSettingsMenu(
      {
        settingsMenuContainer: div('settingsMenuContainer'),
        settingsButton: button('settingsButton'),
        settingsMenu: div('settingsMenu'),
        deleteTokenButton: button('deleteTokenButton'),
      },
      vi.fn(),
    );
    controller.setOpen(true);

    div('settingsMenu').click();

    expect(div('settingsMenu').hidden).toBe(false);
  });

  it('runs the delete callback when the delete button is clicked', () => {
    const onDeleteToken = vi.fn();
    createSettingsMenu(
      {
        settingsMenuContainer: div('settingsMenuContainer'),
        settingsButton: button('settingsButton'),
        settingsMenu: div('settingsMenu'),
        deleteTokenButton: button('deleteTokenButton'),
      },
      onDeleteToken,
    );

    button('deleteTokenButton').click();

    expect(onDeleteToken).toHaveBeenCalledOnce();
  });

  it('does not delete when confirmation is cancelled', () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const onDeleteToken = vi.fn();
    createSettingsMenu(
      {
        settingsMenuContainer: div('settingsMenuContainer'),
        settingsButton: button('settingsButton'),
        settingsMenu: div('settingsMenu'),
        deleteTokenButton: button('deleteTokenButton'),
      },
      onDeleteToken,
    );

    button('deleteTokenButton').click();

    expect(onDeleteToken).not.toHaveBeenCalled();
  });
});
