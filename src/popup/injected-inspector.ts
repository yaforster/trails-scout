export function injectedInspector(request?: {
  type: 'TRAILS_VALIDATE_LOCATOR' | 'TRAILS_RESOLVE_LOCATOR_BOUNDS';
  requestId: string;
  locatorType: 'CSS' | 'XPATH';
  locatorString: string;
  scrollIntoView?: boolean;
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

  if (request?.type === 'TRAILS_RESOLVE_LOCATOR_BOUNDS') {
    const locatorString = request.locatorString.trim();
    const matches =
      request.locatorType === 'CSS'
        ? Array.from(document.querySelectorAll(locatorString))
        : xpathElements(locatorString);
    if (matches.length !== 1) {
      throw new Error(
        matches.length === 0
          ? 'Locator does not match an element.'
          : 'Locator matches multiple elements.',
      );
    }
    const element = matches[0];
    if (request.scrollIntoView) {
      element.scrollIntoView({ block: 'center', inline: 'center' });
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      throw new Error('Locator matches an element without visible bounds.');
    }
    return {
      type: 'TRAILS_LOCATOR_BOUNDS_RESOLVED',
      requestId: request.requestId,
      locatorType: request.locatorType,
      locatorString: request.locatorString,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      viewportWidth: document.documentElement.clientWidth || window.innerWidth,
      viewportHeight: document.documentElement.clientHeight || window.innerHeight,
    };
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
      candidates: generateLocatorCandidates(state.hoveredElement),
      selectedAt: new Date().toISOString(),
    };

    chrome.storage.local.set({ lastSelectedElement: selectedElement });
    chrome.runtime
      .sendMessage({
        type: 'TRAILS_ELEMENT_SELECTED',
        candidates: selectedElement.candidates,
      })
      .catch(() => undefined);
    const firstCssCandidate = selectedElement.candidates.find(
      (candidate) => candidate.locatorType === 'CSS',
    );
    firstCssCandidate
      ? navigator.clipboard?.writeText(firstCssCandidate.locatorString).catch(() => undefined)
      : undefined;
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

  type LocatorCandidate = {
    locatorType: 'CSS' | 'XPATH';
    locatorString: string;
    strategy: string;
  };

  function generateLocatorCandidates(element: Element): LocatorCandidate[] {
    const candidates: LocatorCandidate[] = [];
    const add = (locatorType: 'CSS' | 'XPATH', locatorString: string, strategy: string): void => {
      try {
        const matches =
          locatorType === 'CSS'
            ? Array.from(document.querySelectorAll(locatorString))
            : xpathElements(locatorString);
        if (matches.length === 1 && matches[0] === element) {
          candidates.push({ locatorType, locatorString, strategy });
        }
      } catch {
        // Ignore unusable candidate; structural fallback remains available.
      }
    };

    if (element.id) {
      add('CSS', `#${escapeCss(element.id)}`, 'ID');
    }

    for (const attribute of ['data-testid', 'data-test', 'name', 'aria-label']) {
      const value = element.getAttribute(attribute);
      if (value) {
        add(
          'CSS',
          `${element.tagName.toLowerCase()}[${attribute}="${cssAttributeEscape(value)}"]`,
          attribute,
        );
      }
    }

    add('CSS', structuralCssSelector(element), 'Structural path');

    if (element.id) {
      add('XPATH', `//*[@id=${xpathLiteral(element.id)}]`, 'ID');
    }
    for (const attribute of ['data-testid', 'data-test', 'name', 'aria-label']) {
      const value = element.getAttribute(attribute);
      if (value) {
        add('XPATH', `//*[@${attribute}=${xpathLiteral(value)}]`, attribute);
      }
    }
    add('XPATH', structuralXPath(element), 'Structural path');

    return candidates.filter(
      (candidate, index) =>
        candidates.findIndex(
          (other) =>
            other.locatorType === candidate.locatorType &&
            other.locatorString === candidate.locatorString,
        ) === index,
    );
  }

  function structuralCssSelector(element: Element): string {
    const parts: string[] = [];
    let current: Element | null = element;

    while (current) {
      parts.unshift(selectorPartFor(current));
      current = current.parentElement;
    }

    return parts.join(' > ');
  }

  function selectorPartFor(element: Element): string {
    let selector = element.tagName.toLowerCase();
    const stableClass = Array.from(element.classList ?? []).find(
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

  function structuralXPath(element: Element): string {
    const parts: string[] = [];
    let current: Element | null = element;

    while (current) {
      parts.unshift(`${xpathElementName(current)}[${siblingIndexFor(current)}]`);
      current = current.parentElement;
    }

    return `/${parts.join('/')}`;
  }

  function siblingIndexFor(element: Element): number {
    let index = 1;
    let sibling = element.previousElementSibling;

    while (sibling) {
      if (sibling.tagName === element.tagName && sibling.namespaceURI === element.namespaceURI) {
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
    if (typeof CSS !== 'undefined' && CSS.escape) {
      return CSS.escape(value);
    }

    return Array.from(value)
      .map((character, index) => {
        const codePoint = character.codePointAt(0)!;
        if (codePoint === 0) return '\\FFFD';
        if (
          (codePoint >= 1 && codePoint <= 31) ||
          codePoint === 127 ||
          (index === 0 && codePoint >= 48 && codePoint <= 57) ||
          (index === 1 && codePoint >= 48 && codePoint <= 57 && value[0] === '-')
        ) {
          return `\\${codePoint.toString(16)} `;
        }
        if (index === 0 && character === '-' && value.length === 1) return '\\-';
        return /[a-zA-Z0-9_-]/.test(character) || codePoint >= 128 ? character : `\\${character}`;
      })
      .join('');
  }

  function cssAttributeEscape(value: string): string {
    return Array.from(value)
      .map((character) => {
        if (character === '\\' || character === '"') return `\\${character}`;
        if (character === '\n') return '\\a ';
        if (character === '\r') return '\\d ';
        if (character === '\f') return '\\c ';
        return character;
      })
      .join('');
  }

  function xpathLiteral(value: string): string {
    if (!value.includes("'")) return `'${value}'`;
    if (!value.includes('"')) return `"${value}"`;
    return `concat(${value
      .split(/(['"])/)
      .map((part) => (part === "'" ? '"\'"' : part === '"' ? "'\"'" : `'${part}'`))
      .join(', ')})`;
  }

  function xpathElementName(element: Element): string {
    const tagName = element.tagName.toLowerCase();
    return element.namespaceURI === 'http://www.w3.org/2000/svg'
      ? `*[local-name()=${xpathLiteral(tagName)}]`
      : tagName;
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

  function xpathElements(locatorString: string): Element[] {
    const result = document.evaluate(
      locatorString,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null,
    );
    const elements: Element[] = [];
    for (let index = 0; index < result.snapshotLength; index += 1) {
      const node = result.snapshotItem(index);
      if (node?.nodeType === Node.ELEMENT_NODE) {
        elements.push(node as Element);
      }
    }
    return elements;
  }
}
