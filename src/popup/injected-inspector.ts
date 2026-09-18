export function injectedInspector(request?: {
  type: 'TRAILS_VALIDATE_LOCATOR';
  requestId: string;
  locatorType: 'CSS' | 'XPATH';
  locatorString: string;
}): unknown {
  if (request?.type === 'TRAILS_VALIDATE_LOCATOR') {
    const locatorString = request.locatorString.trim();
    try {
      const matchCount =
        request.locatorType === 'CSS'
          ? document.querySelectorAll(locatorString).length
          : countXPathElements(locatorString);
      const status = matchCount === 0 ? 'no-match' : matchCount === 1 ? 'unique' : 'multiple';
      return {
        type: 'TRAILS_LOCATOR_VALIDATED',
        requestId: request.requestId,
        locatorType: request.locatorType,
        locatorString: request.locatorString,
        matchCount,
        status,
        message:
          status === 'unique'
            ? 'One matching element found.'
            : status === 'multiple'
              ? `${matchCount} matching elements found.`
              : 'No matching element found.',
      };
    } catch {
      return {
        type: 'TRAILS_LOCATOR_VALIDATED',
        requestId: request.requestId,
        locatorType: request.locatorType,
        locatorString: request.locatorString,
        matchCount: 0,
        status: 'invalid',
        message: `Invalid ${request.locatorType} locator.`,
      };
    }
  }

  type InspectorState = {
    active: boolean;
    hoveredElement: Element | null;
    overlay: HTMLDivElement | null;
  };

  const stateKey = '__trailsScoutInspectorState';
  const existingState = (globalThis as unknown as Record<string, InspectorState | undefined>)[
    stateKey
  ];
  const state = existingState ?? {
    active: false,
    hoveredElement: null,
    overlay: null,
  };
  (globalThis as unknown as Record<string, InspectorState>)[stateKey] = state;

  if (state.active) {
    return;
  }

  state.active = true;
  createOverlay();

  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);

  function stopInspector(): void {
    state.active = false;
    state.hoveredElement = null;

    document.removeEventListener('mouseover', handleMouseOver, true);
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);

    state.overlay?.remove();
    state.overlay = null;
  }

  function createOverlay(): void {
    state.overlay?.remove();

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '2147483647';
    overlay.style.border = '2px solid #16a34a';
    overlay.style.background = 'rgba(22, 163, 74, 0.12)';
    overlay.style.boxSizing = 'border-box';
    overlay.style.borderRadius = '4px';
    overlay.style.display = 'none';

    document.documentElement.appendChild(overlay);
    state.overlay = overlay;
  }

  function handleMouseOver(event: MouseEvent): void {
    if (!state.active || !(event.target instanceof Element)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    state.hoveredElement = event.target;
    updateOverlay(state.hoveredElement);
  }

  function handleMouseMove(event: MouseEvent): void {
    if (!state.active || !state.hoveredElement) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    updateOverlay(state.hoveredElement);
  }

  function handleClick(event: MouseEvent): void {
    if (!state.active || !state.hoveredElement) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const selectedElement = {
      cssSelector: generateCssSelector(state.hoveredElement),
      xpath: generateXPath(state.hoveredElement),
      selectedAt: new Date().toISOString(),
    };

    chrome.storage.local.set({ lastSelectedElement: selectedElement });
    chrome.runtime
      .sendMessage({
        type: 'TRAILS_ELEMENT_SELECTED',
        cssSelector: selectedElement.cssSelector,
        xpath: selectedElement.xpath,
      })
      .catch(() => undefined);
    navigator.clipboard?.writeText(selectedElement.cssSelector).catch(() => undefined);
    stopInspector();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      chrome.runtime.sendMessage({ type: 'TRAILS_INSPECTOR_CANCELLED' }).catch(() => undefined);
      stopInspector();
    }
  }

  function updateOverlay(element: Element): void {
    if (!state.overlay) {
      return;
    }

    const rect = element.getBoundingClientRect();
    state.overlay.style.display = 'block';
    state.overlay.style.top = `${rect.top}px`;
    state.overlay.style.left = `${rect.left}px`;
    state.overlay.style.width = `${rect.width}px`;
    state.overlay.style.height = `${rect.height}px`;
  }

  function generateCssSelector(element: Element): string {
    if (!(element instanceof HTMLElement)) {
      return element.tagName.toLowerCase();
    }

    if (element.id) {
      return `#${escapeCss(element.id)}`;
    }

    const stableAttributeSelector = stableAttributeSelectorFor(element);
    if (stableAttributeSelector) {
      return stableAttributeSelector;
    }

    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current instanceof HTMLElement && current !== document.body) {
      parts.unshift(selectorPartFor(current));
      current = current.parentElement;
    }

    return parts.join(' > ');
  }

  function stableAttributeSelectorFor(element: HTMLElement): string | null {
    const tagName = element.tagName.toLowerCase();
    const stableAttributes = ['data-testid', 'data-test', 'name', 'aria-label'];

    for (const attribute of stableAttributes) {
      const value = element.getAttribute(attribute);
      if (value) {
        return `${tagName}[${attribute}="${cssAttributeEscape(value)}"]`;
      }
    }

    return null;
  }

  function selectorPartFor(element: HTMLElement): string {
    let selector = element.tagName.toLowerCase();
    const stableClass = Array.from(element.classList).find(
      (className) => !looksGenerated(className),
    );

    if (stableClass) {
      selector += `.${escapeCss(stableClass)}`;
    }

    const parent = element.parentElement;
    if (!parent) {
      return selector;
    }

    const sameTagSiblings = Array.from(parent.children).filter(
      (child) => child.tagName === element.tagName,
    );
    if (sameTagSiblings.length > 1) {
      selector += `:nth-of-type(${sameTagSiblings.indexOf(element) + 1})`;
    }

    return selector;
  }

  function generateXPath(element: Element): string {
    if (element.id) {
      return `//*[@id="${xpathEscape(element.id)}"]`;
    }

    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const tagName = current.tagName.toLowerCase();
      parts.unshift(`${tagName}[${siblingIndexFor(current, tagName)}]`);
      current = current.parentElement;
    }

    return `/${parts.join('/')}`;
  }

  function siblingIndexFor(element: Element, tagName: string): number {
    let index = 1;
    let sibling = element.previousElementSibling;

    while (sibling) {
      if (sibling.tagName.toLowerCase() === tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }

    return index;
  }

  function looksGenerated(className: string): boolean {
    return (
      className.length > 20 ||
      /[a-f0-9]{6,}/i.test(className) ||
      /^css-[a-z0-9]+/i.test(className) ||
      /^_[a-z0-9]+/i.test(className)
    );
  }

  function escapeCss(value: string): string {
    return typeof CSS !== 'undefined' && CSS.escape
      ? CSS.escape(value)
      : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function cssAttributeEscape(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function xpathEscape(value: string): string {
    return value.replace(/"/g, '\\"');
  }

  function countXPathElements(locatorString: string): number {
    const result = document.evaluate(
      locatorString,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null,
    );
    let count = 0;
    for (let index = 0; index < result.snapshotLength; index += 1) {
      if (result.snapshotItem(index)?.nodeType === Node.ELEMENT_NODE) {
        count += 1;
      }
    }
    return count;
  }
}
