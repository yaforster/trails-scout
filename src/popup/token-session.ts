import type { KeycloakTokenResponse, PopupSettings } from './types';
import { hasUnexpiredToken } from './token-utils';

export interface TokenSnapshot {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: number | null;
  refreshTokenExpiresAt: number | null;
}

export interface PasswordTokenRequest {
  clientId: string;
  username: string;
  password: string;
  clientSecret?: string;
}

export interface RefreshTokenRequest {
  clientId: string;
  refreshToken: string;
  clientSecret?: string;
}

export class TokenSession {
  private state: TokenSnapshot = emptyTokenSnapshot();

  get accessToken(): string | null {
    return this.state.accessToken;
  }

  get refreshToken(): string | null {
    return this.state.refreshToken;
  }

  get accessTokenExpiresAt(): number | null {
    return this.state.accessTokenExpiresAt;
  }

  restore(settings: PopupSettings): void {
    this.state = {
      accessToken: settings.accessToken ?? null,
      refreshToken: settings.refreshToken ?? null,
      accessTokenExpiresAt: settings.accessTokenExpiresAt ?? null,
      refreshTokenExpiresAt: settings.refreshTokenExpiresAt ?? null,
    };
  }

  clear(): TokenSnapshot {
    this.state = emptyTokenSnapshot();
    return this.snapshot();
  }

  hasValidAccessToken(now = Date.now()): boolean {
    return hasUnexpiredToken(this.state.accessToken, this.state.accessTokenExpiresAt, now);
  }

  canRefreshToken(now = Date.now()): boolean {
    return hasUnexpiredToken(this.state.refreshToken, this.state.refreshTokenExpiresAt, now);
  }

  applyResponse(result: KeycloakTokenResponse, now = Date.now()): TokenSnapshot {
    if (!result.access_token || !result.expires_in) {
      throw new Error('Keycloak response did not include an access token and expiry.');
    }

    this.state = {
      accessToken: result.access_token,
      refreshToken: result.refresh_token ?? this.state.refreshToken,
      accessTokenExpiresAt: now + result.expires_in * 1000,
      refreshTokenExpiresAt: result.refresh_expires_in
        ? now + result.refresh_expires_in * 1000
        : this.state.refreshTokenExpiresAt,
    };

    return this.snapshot();
  }

  snapshot(): TokenSnapshot {
    return { ...this.state };
  }
}

export function buildPasswordTokenRequestBody(request: PasswordTokenRequest): URLSearchParams {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: request.clientId,
    username: request.username,
    password: request.password,
  });

  if (request.clientSecret) {
    body.set('client_secret', request.clientSecret);
  }

  return body;
}

export function buildRefreshTokenRequestBody(request: RefreshTokenRequest): URLSearchParams {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: request.clientId,
    refresh_token: request.refreshToken,
  });

  if (request.clientSecret) {
    body.set('client_secret', request.clientSecret);
  }

  return body;
}

function emptyTokenSnapshot(): TokenSnapshot {
  return {
    accessToken: null,
    refreshToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
  };
}
