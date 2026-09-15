import { describe, expect, it } from 'vitest';
import {
  buildPasswordTokenRequestBody,
  buildRefreshTokenRequestBody,
  TokenSession,
} from './token-session';

describe('token session', () => {
  it('restores a persisted token snapshot', () => {
    const session = new TokenSession();

    session.restore({
      accessToken: 'access',
      refreshToken: 'refresh',
      accessTokenExpiresAt: 2_000,
      refreshTokenExpiresAt: 3_000,
    });

    expect(session.snapshot()).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      accessTokenExpiresAt: 2_000,
      refreshTokenExpiresAt: 3_000,
    });
  });

  it('checks access and refresh token expiry against an injectable clock', () => {
    const session = new TokenSession();
    session.restore({
      accessToken: 'access',
      refreshToken: 'refresh',
      accessTokenExpiresAt: 2_000,
      refreshTokenExpiresAt: 3_000,
    });

    expect(session.hasValidAccessToken(1_999)).toBe(true);
    expect(session.hasValidAccessToken(2_000)).toBe(false);
    expect(session.canRefreshToken(2_999)).toBe(true);
    expect(session.canRefreshToken(3_000)).toBe(false);
  });

  it('applies a Keycloak token response', () => {
    const session = new TokenSession();

    const snapshot = session.applyResponse(
      {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 60,
        refresh_expires_in: 120,
      },
      1_000,
    );

    expect(snapshot).toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      accessTokenExpiresAt: 61_000,
      refreshTokenExpiresAt: 121_000,
    });
  });

  it('keeps the existing refresh token when a refresh response omits it', () => {
    const session = new TokenSession();
    session.restore({
      refreshToken: 'existing-refresh',
      refreshTokenExpiresAt: 120_000,
    });

    const snapshot = session.applyResponse(
      {
        access_token: 'new-access',
        expires_in: 60,
      },
      1_000,
    );

    expect(snapshot.refreshToken).toBe('existing-refresh');
    expect(snapshot.refreshTokenExpiresAt).toBe(120_000);
  });

  it('clears all token state', () => {
    const session = new TokenSession();
    session.restore({
      accessToken: 'access',
      refreshToken: 'refresh',
      accessTokenExpiresAt: 2_000,
      refreshTokenExpiresAt: 3_000,
    });

    expect(session.clear()).toEqual({
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
    });
  });

  it('builds password grant request bodies', () => {
    const body = buildPasswordTokenRequestBody({
      clientId: 'trails-demo',
      username: 'alice',
      password: 'secret',
      clientSecret: 'client-secret',
    });

    expect(Object.fromEntries(body)).toEqual({
      grant_type: 'password',
      client_id: 'trails-demo',
      username: 'alice',
      password: 'secret',
      client_secret: 'client-secret',
    });
  });

  it('builds refresh grant request bodies without an empty client secret', () => {
    const body = buildRefreshTokenRequestBody({
      clientId: 'trails-demo',
      refreshToken: 'refresh',
      clientSecret: '',
    });

    expect(Object.fromEntries(body)).toEqual({
      grant_type: 'refresh_token',
      client_id: 'trails-demo',
      refresh_token: 'refresh',
    });
  });
});
