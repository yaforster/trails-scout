import type { ElementType } from './types';

export const tokenRefreshSafetyMs = 30_000;
export const minimumRefreshDelayMs = 5_000;
export const resourcePageSize = 100;

export const elementTypes: ElementType[] = [
  'SELECT',
  'RADIO',
  'BUTTON',
  'TEXT',
  'INPUT',
  'CHECKBOX',
  'COLORPICKER',
  'DATEPICKER',
  'DATETIMEPICKER',
  'FILEUPLOAD',
  'RANGE',
  'TIME',
  'WEEK',
];
