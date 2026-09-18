import { describe, expect, it, vi } from 'vitest';
import { createQueueController, type QueueCandidate } from './queue-controller';

function candidate(locatorString: string): QueueCandidate {
  return {
    target: {
      applicationId: '1',
      applicationLabel: 'Shop',
      stageId: '2',
      stageLabel: 'Production',
    },
    definition: {
      type: 'BUTTON',
      label: locatorString,
      locatorType: 'CSS',
      locatorString,
    },
    validation: {
      type: 'TRAILS_LOCATOR_VALIDATED',
      requestId: locatorString,
      locatorType: 'CSS',
      locatorString,
      matchCount: 1,
      status: 'unique',
      message: 'One matching element found.',
    },
  };
}

function createHarness() {
  document.body.innerHTML = `
    <button id="add"></button><button id="create"></button><button id="clear"></button>
    <span id="count"></span><ol id="list"></ol>
  `;
  let current: QueueCandidate | null = candidate('#one');
  const createElement = vi.fn(async (item) => {
    if (item.definition.locatorString === '#two') {
      throw new Error('Service unavailable.');
    }
  });
  const setStatus = vi.fn();
  const controller = createQueueController(
    {
      addButton: document.getElementById('add') as HTMLButtonElement,
      createButton: document.getElementById('create') as HTMLButtonElement,
      clearButton: document.getElementById('clear') as HTMLButtonElement,
      count: document.getElementById('count')!,
      list: document.getElementById('list')!,
    },
    { getCandidate: () => current, createElement, setStatus },
  );
  return {
    controller,
    createElement,
    setStatus,
    setCurrent: (value: QueueCandidate) => (current = value),
  };
}

describe('capture queue', () => {
  it('rejects duplicate locators and creates sequentially with retry state', async () => {
    const { controller, createElement, setCurrent, setStatus } = createHarness();
    controller.addCurrent();
    controller.addCurrent();
    expect(controller.getItems()).toHaveLength(1);

    setCurrent(candidate('#two'));
    controller.addCurrent();
    setCurrent(candidate('#three'));
    controller.addCurrent();
    expect(controller.getItems()).toHaveLength(3);

    await controller.createAll();
    expect(createElement).toHaveBeenCalledTimes(2);
    expect(controller.getItems().map((item) => item.status)).toEqual([
      'created',
      'failed',
      'queued',
    ]);
    expect(setStatus).toHaveBeenLastCalledWith(
      '1 created, 1 failed. 2 items remain for retry.',
      'error',
    );

    await controller.createAll();
    expect(createElement).toHaveBeenCalledTimes(3);
    expect(controller.getItems().map((item) => item.status)).toEqual([
      'created',
      'failed',
      'queued',
    ]);
  });

  it('clears the queue only after target-change confirmation', () => {
    const { controller } = createHarness();
    controller.addCurrent();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(controller.confirmTargetChange()).toBe(false);
    expect(controller.getItems()).toHaveLength(1);

    vi.mocked(window.confirm).mockReturnValue(true);
    expect(controller.confirmTargetChange()).toBe(true);
    expect(controller.getItems()).toHaveLength(0);
  });
});
