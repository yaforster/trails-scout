import type { TokenStatusType } from './types';
import { formatDuration, tokenIconName } from './token-utils';

interface TokenPanelElements {
  showTokenIcon: HTMLElement;
  showTokenLabel: HTMLElement;
  tokenFeedback: HTMLElement;
  tokenFeedbackIcon: HTMLElement;
  tokenFeedbackText: HTMLElement;
  tokenBox: HTMLElement;
  tokenOutput: HTMLTextAreaElement;
}

interface TokenPanelDependencies {
  getAccessToken(): string | null;
  getAccessTokenExpiresAt(): number | null;
  renderIcons(): void;
}

export interface TokenPanelController {
  clearCountdown(): void;
  clearOutput(): void;
  setExpiringStatus(message: string, type: TokenStatusType): void;
  setStatus(message: string, type: TokenStatusType): void;
  setVisibility(visible: boolean): void;
  syncVisibleToken(): void;
  toggleVisibility(): void;
}

export function createTokenPanelController(
  elements: TokenPanelElements,
  dependencies: TokenPanelDependencies,
): TokenPanelController {
  let countdownIntervalId: number | null = null;
  let feedbackMessage: string | null = null;
  let feedbackType: TokenStatusType = 'success';

  const {
    showTokenIcon,
    showTokenLabel,
    tokenFeedback,
    tokenFeedbackIcon,
    tokenFeedbackText,
    tokenBox,
    tokenOutput,
  } = elements;
  const { getAccessToken, getAccessTokenExpiresAt, renderIcons } = dependencies;

  function toggleVisibility(): void {
    if (!getAccessToken()) {
      setStatus('No token available.', 'error');
      return;
    }

    setVisibility(tokenBox.style.display !== 'block');
  }

  function setVisibility(visible: boolean): void {
    tokenBox.style.display = visible ? 'block' : 'none';
    tokenOutput.value = visible ? (getAccessToken() ?? '') : '';
    setIconName(showTokenIcon, visible ? 'eye-off' : 'eye');
    showTokenLabel.textContent = visible ? 'Hide token' : 'Show token';
    renderIcons();
  }

  function clearOutput(): void {
    tokenOutput.value = '';
  }

  function syncVisibleToken(): void {
    if (tokenBox.style.display === 'block') {
      tokenOutput.value = getAccessToken() ?? '';
    }
  }

  function setStatus(message: string, type: TokenStatusType): void {
    clearCountdown();
    feedbackMessage = null;
    tokenFeedback.removeAttribute('title');
    setTokenIcon(type);
    tokenFeedbackText.textContent = message;
    tokenFeedback.className = `token-feedback visible ${type}`;
    renderIcons();
  }

  function setExpiringStatus(message: string, type: TokenStatusType): void {
    clearCountdown();
    feedbackMessage = message;
    feedbackType = type;
    setTokenIcon(type);
    updateExpiringStatus();
    countdownIntervalId = window.setInterval(updateExpiringStatus, 1000);
    renderIcons();
  }

  function clearCountdown(): void {
    if (countdownIntervalId !== null) {
      window.clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }
  }

  function setTokenIcon(type: TokenStatusType): void {
    setIconName(tokenFeedbackIcon, tokenIconName(type));
  }

  function updateExpiringStatus(): void {
    const accessTokenExpiresAt = getAccessTokenExpiresAt();
    if (!feedbackMessage || !accessTokenExpiresAt) {
      return;
    }

    const remainingMs = accessTokenExpiresAt - Date.now();
    if (remainingMs <= 0) {
      tokenFeedbackText.textContent = feedbackMessage;
      tokenFeedback.title = 'Token expired.';
      tokenFeedback.className = 'token-feedback visible error';
      return;
    }

    tokenFeedbackText.textContent = feedbackMessage;
    tokenFeedback.title = `Expires in ${formatDuration(remainingMs)}.`;
    tokenFeedback.className = `token-feedback visible ${feedbackType}`;
  }

  return {
    clearCountdown,
    clearOutput,
    setExpiringStatus,
    setStatus,
    setVisibility,
    syncVisibleToken,
    toggleVisibility,
  };
}

function setIconName(element: HTMLElement, iconName: string): void {
  element.dataset.lucide = iconName;
}
