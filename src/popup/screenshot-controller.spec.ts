import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createScreenshotController } from './screenshot-controller';
import type { LocatorBoundsResult } from '../locator-selectors';

const { query, captureVisibleTab } = vi.hoisted(() => ({
  query: vi.fn(),
  captureVisibleTab: vi.fn(),
}));

const bounds: LocatorBoundsResult = {
  type: 'TRAILS_LOCATOR_BOUNDS_RESOLVED',
  requestId: '1',
  locatorType: 'CSS',
  locatorString: '#checkout',
  left: 40,
  top: 20,
  width: 120,
  height: 80,
  viewportWidth: 400,
  viewportHeight: 300,
};

vi.mock('webextension-polyfill', () => ({
  default: { tabs: { query, captureVisibleTab } },
}));

function renderElements() {
  document.body.innerHTML = `
    <button id="capture"></button>
    <button id="replace"></button>
    <button id="remove"></button>
    <img id="preview" />
    <span id="details"></span>
    <span id="feedback"></span>
  `;
  return {
    captureButton: document.querySelector<HTMLButtonElement>('#capture')!,
    replaceButton: document.querySelector<HTMLButtonElement>('#replace')!,
    removeButton: document.querySelector<HTMLButtonElement>('#remove')!,
    preview: document.querySelector<HTMLImageElement>('#preview')!,
    details: document.querySelector<HTMLElement>('#details')!,
    feedback: document.querySelector<HTMLElement>('#feedback')!,
  };
}

describe('screenshot controller', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    query.mockReset();
    captureVisibleTab.mockReset();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 120, height: 80, close: vi.fn() }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('png')));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['cropped'], { type: 'image/png' }));
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  it('captures only supported active tabs and exposes preview dimensions', async () => {
    query.mockResolvedValue([{ id: 3, windowId: 4, url: 'https://example.test/page' }]);
    captureVisibleTab.mockResolvedValue('data:image/png;base64,abc');
    const elements = renderElements();
    const setStatus = vi.fn();
    const controller = createScreenshotController(elements, setStatus, {
      getLocator: () => ({ locatorType: 'CSS', locatorString: '#checkout' }),
      getLocatorBounds: vi.fn().mockResolvedValue(bounds),
    });

    await controller.capture();

    expect(captureVisibleTab).toHaveBeenCalledWith(4, { format: 'png' });
    expect(controller.getState()).toMatchObject({ width: 51, height: 34 });
    expect(elements.preview.hidden).toBe(false);
    expect(elements.details.textContent).toBe('51 x 34px');
  });

  it('blocks restricted tabs and releases preview URL on remove', async () => {
    query.mockResolvedValue([{ id: 3, windowId: 4, url: 'chrome://settings' }]);
    const elements = renderElements();
    const setStatus = vi.fn();
    const controller = createScreenshotController(elements, setStatus, {
      getLocator: () => ({ locatorType: 'CSS', locatorString: '#checkout' }),
      getLocatorBounds: vi.fn().mockResolvedValue(bounds),
    });

    await controller.capture();
    expect(captureVisibleTab).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith('Screenshot not captured.', 'error');

    query.mockResolvedValue([{ id: 3, windowId: 4, url: 'https://example.test' }]);
    captureVisibleTab.mockResolvedValue('data:image/png;base64,abc');
    await controller.capture();
    controller.remove();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    expect(controller.getState()).toBeNull();
  });
});
