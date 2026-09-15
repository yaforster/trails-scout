import type {
  ElementDefinition,
  ElementType,
  LocatorType,
  SelectedLocator,
  TokenStatusType,
} from './types';

export type ElementDefinitionValidation =
  | { valid: true; definition: ElementDefinition }
  | { valid: false; message: string };

export function hasUnexpiredToken(
  token: string | null,
  expiresAt: number | null,
  now = Date.now(),
): boolean {
  return Boolean(token && expiresAt && expiresAt > now);
}

export function locatorStringFor(
  locator: SelectedLocator | null,
  locatorType: LocatorType,
): string {
  if (!locator) {
    return '';
  }

  return locatorType === 'XPATH' ? locator.xpath : locator.cssSelector;
}

export function toElementDefinition(
  locator: SelectedLocator | null,
  locatorType: LocatorType,
  elementType: ElementType,
  label: string,
): ElementDefinitionValidation {
  const locatorString = locatorStringFor(locator, locatorType);
  const trimmedLabel = label.trim();

  if (!locator || !locatorString) {
    return { valid: false, message: 'Pick a locator before creating an element.' };
  }

  if (!trimmedLabel) {
    return { valid: false, message: 'Element label is required.' };
  }

  return {
    valid: true,
    definition: {
      type: elementType,
      label: trimmedLabel,
      locatorString,
      locatorType,
    },
  };
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${twoDigit(seconds)}s`;
}

export function tokenIconName(type: TokenStatusType): string {
  switch (type) {
    case 'success':
      return 'circle-check';
    case 'error':
      return 'circle-alert';
    case 'pending':
      return 'loader-circle';
  }
}

function twoDigit(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}
