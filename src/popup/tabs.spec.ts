import { beforeEach, describe, expect, it } from 'vitest';
import { createTabController } from './tabs';

function button(id: string): HTMLButtonElement {
  return document.getElementById(id) as HTMLButtonElement;
}

function panel(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

function renderTabs(): void {
  document.body.innerHTML = `
        <button id="authTab"></button>
        <button id="targetTab"></button>
        <button id="elementTab"></button>
        <section id="authPanel"></section>
        <section id="targetPanel"></section>
        <section id="elementPanel"></section>
    `;
}

describe('tab controller', () => {
  beforeEach(() => {
    renderTabs();
  });

  it('activates an enabled target tab', () => {
    const controller = createTabController(
      {
        authTab: button('authTab'),
        targetTab: button('targetTab'),
        elementTab: button('elementTab'),
        authPanel: panel('authPanel'),
        targetPanel: panel('targetPanel'),
        elementPanel: panel('elementPanel'),
      },
      () => true,
      () => false,
    );

    controller.activate('target');

    expect(button('targetTab').classList.contains('active')).toBe(true);
    expect(panel('targetPanel').hidden).toBe(false);
    expect(panel('authPanel').hidden).toBe(true);
  });

  it('does not activate a disabled target tab', () => {
    const controller = createTabController(
      {
        authTab: button('authTab'),
        targetTab: button('targetTab'),
        elementTab: button('elementTab'),
        authPanel: panel('authPanel'),
        targetPanel: panel('targetPanel'),
        elementPanel: panel('elementPanel'),
      },
      () => false,
      () => false,
    );

    controller.activate('target');

    expect(button('targetTab').classList.contains('active')).toBe(false);
  });

  it('marks unavailable tabs as disabled', () => {
    const controller = createTabController(
      {
        authTab: button('authTab'),
        targetTab: button('targetTab'),
        elementTab: button('elementTab'),
        authPanel: panel('authPanel'),
        targetPanel: panel('targetPanel'),
        elementPanel: panel('elementPanel'),
      },
      () => false,
      () => false,
    );

    controller.refreshAvailability();

    expect(button('targetTab').disabled).toBe(true);
    expect(button('elementTab').getAttribute('aria-disabled')).toBe('true');
  });

  it('moves from an unavailable element tab back to target when possible', () => {
    let elementEnabled = true;
    const controller = createTabController(
      {
        authTab: button('authTab'),
        targetTab: button('targetTab'),
        elementTab: button('elementTab'),
        authPanel: panel('authPanel'),
        targetPanel: panel('targetPanel'),
        elementPanel: panel('elementPanel'),
      },
      () => true,
      () => elementEnabled,
    );
    controller.activate('element');

    elementEnabled = false;
    controller.refreshAvailability();

    expect(button('targetTab').classList.contains('active')).toBe(true);
  });
});
