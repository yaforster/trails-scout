import type { StatusType } from './types';

export function createStatusView(statusElement: HTMLDivElement) {
  return (message: string, type: StatusType = 'idle'): void => {
    statusElement.textContent = message;
    statusElement.className = `status ${type === 'idle' ? '' : type}`;
  };
}
