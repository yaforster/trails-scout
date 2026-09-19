export interface InspectorMessage {
  type: 'TRAILS_START_INSPECTOR';
}

export type LocatorValidationStatus = 'no-match' | 'unique' | 'multiple' | 'invalid';
export type LocatorType = 'CSS' | 'XPATH';

export interface LocatorCandidate {
  locatorType: LocatorType;
  locatorString: string;
  strategy: string;
}

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
  candidates: LocatorCandidate[];
}

export interface StoredSelectedElement {
  candidates: LocatorCandidate[];
  selectedAt: string;
}

const stableAttributes = ['data-testid', 'data-test', 'name', 'aria-label'];

export function createSelectedElement(
  element: Element,
  selectedAt = new Date().toISOString(),
): StoredSelectedElement {
  return {
    candidates: generateLocatorCandidates(element),
    selectedAt,
  };
}

export function toSelectedElementMessage(
  selectedElement: StoredSelectedElement,
): SelectedElementMessage {
  return {
    type: 'TRAILS_ELEMENT_SELECTED',
    candidates: selectedElement.candidates,
  };
}

export function generateCssSelector(element: Element): string {
  return candidateFor(generateLocatorCandidates(element), 'CSS');
}

export function generateXPath(element: Element): string {
  return candidateFor(generateLocatorCandidates(element), 'XPATH');
}

export function generateLocatorCandidates(element: Element): LocatorCandidate[] {
  const documentRef = element.ownerDocument;
  if (!documentRef) {
    return [];
  }

  const candidates: LocatorCandidate[] = [];
  const addCss = (locatorString: string, strategy: string): void => {
    if (matchesOnlyElement(documentRef, 'CSS', locatorString, element)) {
      candidates.push({ locatorType: 'CSS', locatorString, strategy });
    }
  };
  const addXPath = (locatorString: string, strategy: string): void => {
    if (matchesOnlyElement(documentRef, 'XPATH', locatorString, element)) {
      candidates.push({ locatorType: 'XPATH', locatorString, strategy });
    }
  };

  if (element.id) {
    addCss(`#${escapeCss(element.id)}`, 'ID');
  }
  for (const attribute of stableAttributes) {
    const value = element.getAttribute(attribute);
    if (value) {
      addCss(
        `${element.tagName.toLowerCase()}[${attribute}="${cssAttributeEscape(value)}"]`,
        attribute,
      );
    }
  }
  addCss(structuralCssSelector(element), 'Structural path');

  if (element.id) {
    addXPath(`//*[@id=${xpathLiteral(element.id)}]`, 'ID');
  }
  for (const attribute of stableAttributes) {
    const value = element.getAttribute(attribute);
    if (value) {
      addXPath(`//*[@${attribute}=${xpathLiteral(value)}]`, attribute);
    }
  }
  addXPath(structuralXPath(element), 'Structural path');

  return candidates.filter(
    (candidate, index) =>
      candidates.findIndex(
        (other) =>
          other.locatorType === candidate.locatorType &&
          other.locatorString === candidate.locatorString,
      ) === index,
  );
}

function candidateFor(candidates: LocatorCandidate[], locatorType: LocatorType): string {
  return candidates.find((candidate) => candidate.locatorType === locatorType)?.locatorString ?? '';
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

function structuralXPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current) {
    parts.unshift(`${xpathElementName(current)}[${siblingIndexFor(current)}]`);
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

function escapeCss(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value);
  }

  return Array.from(value)
    .map((character, index) => {
      const codePoint = character.codePointAt(0)!;
      if (codePoint === 0) {
        return '\\FFFD';
      }
      if (
        (codePoint >= 1 && codePoint <= 31) ||
        codePoint === 127 ||
        (index === 0 && codePoint >= 48 && codePoint <= 57) ||
        (index === 1 && codePoint >= 48 && codePoint <= 57 && value[0] === '-')
      ) {
        return `\\${codePoint.toString(16)} `;
      }
      if (index === 0 && character === '-' && value.length === 1) {
        return '\\-';
      }
      return /[a-zA-Z0-9_-]/.test(character) || codePoint >= 128 ? character : `\\${character}`;
    })
    .join('');
}

function cssAttributeEscape(value: string): string {
  return Array.from(value)
    .map((character) => {
      if (character === '\\' || character === '"') {
        return `\\${character}`;
      }
      if (character === '\n') {
        return '\\a ';
      }
      if (character === '\r') {
        return '\\d ';
      }
      if (character === '\f') {
        return '\\c ';
      }
      return character;
    })
    .join('');
}

function xpathLiteral(value: string): string {
  if (!value.includes("'")) {
    return `'${value}'`;
  }
  if (!value.includes('"')) {
    return `"${value}"`;
  }
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

function matchesOnlyElement(
  documentRef: Document,
  locatorType: LocatorType,
  locatorString: string,
  element: Element,
): boolean {
  try {
    const matches =
      locatorType === 'CSS'
        ? Array.from(documentRef.querySelectorAll(locatorString))
        : xpathElements(documentRef, locatorString);
    return matches.length === 1 && matches[0] === element;
  } catch {
    return false;
  }
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
