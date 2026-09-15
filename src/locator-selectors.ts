export interface InspectorMessage {
  type: 'TRAILS_START_INSPECTOR';
}

export interface SelectedElementMessage {
  type: 'TRAILS_ELEMENT_SELECTED';
  cssSelector: string;
  xpath: string;
}

export interface StoredSelectedElement {
  cssSelector: string;
  xpath: string;
  selectedAt: string;
}

const stableAttributes = ['data-testid', 'data-test', 'name', 'aria-label'];

export function createSelectedElement(
  element: Element,
  selectedAt = new Date().toISOString(),
): StoredSelectedElement {
  return {
    cssSelector: generateCssSelector(element),
    xpath: generateXPath(element),
    selectedAt,
  };
}

export function toSelectedElementMessage(
  selectedElement: StoredSelectedElement,
): SelectedElementMessage {
  return {
    type: 'TRAILS_ELEMENT_SELECTED',
    cssSelector: selectedElement.cssSelector,
    xpath: selectedElement.xpath,
  };
}

export function generateCssSelector(element: Element): string {
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

export function generateXPath(element: Element): string {
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

export function isInspectorMessage(message: unknown): message is InspectorMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'TRAILS_START_INSPECTOR'
  );
}

export function looksGenerated(className: string): boolean {
  return (
    className.length > 20 ||
    /[a-f0-9]{6,}/i.test(className) ||
    /^css-[a-z0-9]+/i.test(className) ||
    /^_[a-z0-9]+/i.test(className)
  );
}

function stableAttributeSelectorFor(element: HTMLElement): string | null {
  const tagName = element.tagName.toLowerCase();

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
  const stableClass = Array.from(element.classList).find((className) => !looksGenerated(className));

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
