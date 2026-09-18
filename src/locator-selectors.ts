export interface InspectorMessage {
  type: 'TRAILS_START_INSPECTOR';
}

export type LocatorValidationStatus = 'no-match' | 'unique' | 'multiple' | 'invalid';

export interface ValidateLocatorMessage {
  type: 'TRAILS_VALIDATE_LOCATOR';
  requestId: string;
  locatorType: 'CSS' | 'XPATH';
  locatorString: string;
}

export interface LocatorValidationResult {
  type: 'TRAILS_LOCATOR_VALIDATED';
  requestId: string;
  locatorType: 'CSS' | 'XPATH';
  locatorString: string;
  matchCount: number;
  status: LocatorValidationStatus;
  message: string;
}

export interface ResolveLocatorBoundsMessage {
  type: 'TRAILS_RESOLVE_LOCATOR_BOUNDS';
  requestId: string;
  locatorType: 'CSS' | 'XPATH';
  locatorString: string;
  scrollIntoView?: boolean;
}

export interface LocatorBoundsResult {
  type: 'TRAILS_LOCATOR_BOUNDS_RESOLVED';
  requestId: string;
  locatorType: 'CSS' | 'XPATH';
  locatorString: string;
  left: number;
  top: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
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

export function isValidateLocatorMessage(message: unknown): message is ValidateLocatorMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Record<string, unknown>).type === 'TRAILS_VALIDATE_LOCATOR' &&
    typeof (message as Record<string, unknown>).requestId === 'string' &&
    ((message as Record<string, unknown>).locatorType === 'CSS' ||
      (message as Record<string, unknown>).locatorType === 'XPATH') &&
    typeof (message as Record<string, unknown>).locatorString === 'string'
  );
}

export function isResolveLocatorBoundsMessage(
  message: unknown,
): message is ResolveLocatorBoundsMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as Record<string, unknown>).type === 'TRAILS_RESOLVE_LOCATOR_BOUNDS' &&
    typeof (message as Record<string, unknown>).requestId === 'string' &&
    ((message as Record<string, unknown>).locatorType === 'CSS' ||
      (message as Record<string, unknown>).locatorType === 'XPATH') &&
    typeof (message as Record<string, unknown>).locatorString === 'string'
  );
}

export function resolveLocatorBoundsInDocument(
  request: Pick<
    ResolveLocatorBoundsMessage,
    'requestId' | 'locatorType' | 'locatorString' | 'scrollIntoView'
  >,
  documentRef: Document = document,
): LocatorBoundsResult {
  const locatorString = request.locatorString.trim();
  const matches =
    request.locatorType === 'CSS'
      ? Array.from(documentRef.querySelectorAll(locatorString))
      : xpathElements(documentRef, locatorString);
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
    viewportWidth: documentRef.documentElement.clientWidth || window.innerWidth,
    viewportHeight: documentRef.documentElement.clientHeight || window.innerHeight,
  };
}

export function validateLocatorInDocument(
  request: Pick<ValidateLocatorMessage, 'requestId' | 'locatorType' | 'locatorString'>,
  documentRef: Document = document,
): LocatorValidationResult {
  const locatorString = request.locatorString.trim();
  try {
    const matchCount =
      request.locatorType === 'CSS'
        ? documentRef.querySelectorAll(locatorString).length
        : countXPathElements(documentRef, locatorString);
    const status: LocatorValidationStatus =
      matchCount === 0 ? 'no-match' : matchCount === 1 ? 'unique' : 'multiple';
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

function countXPathElements(documentRef: Document, locatorString: string): number {
  const result = documentRef.evaluate(
    locatorString,
    documentRef,
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

function xpathElements(documentRef: Document, locatorString: string): Element[] {
  const result = documentRef.evaluate(
    locatorString,
    documentRef,
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
