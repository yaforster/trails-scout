import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizationHeaders,
  fetchAllPages,
  fetchAllPagesWithLinks,
  putElement,
  resolveResourceLink,
  testHealthEndpoint,
} from './api';
import type { ElementDefinition, PagedResource, PersistedElement } from './types';

vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        get: vi.fn(),
      },
    },
    tabs: {
      query: vi.fn(),
    },
  },
}));

function jsonResponse<T>(body: T, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('popup api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildAuthorizationHeaders', () => {
    it('returns an empty header object when no token exists', () => {
      const result = buildAuthorizationHeaders(null);

      expect(result).toEqual({});
    });

    it('returns a bearer token header when a token exists', () => {
      const result = buildAuthorizationHeaders('abc.123');

      expect(result).toEqual({ Authorization: 'Bearer abc.123' });
    });
  });

  describe('testHealthEndpoint', () => {
    it('calls the health endpoint with an authorization header', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(jsonResponse({ status: 'UP' }));

      await testHealthEndpoint('https://trails.local', 'access-token');

      expect(fetchSpy).toHaveBeenCalledWith('https://trails.local/actuator/health', {
        method: 'GET',
        headers: { Authorization: 'Bearer access-token' },
      });
    });
  });

  describe('fetchAllPages', () => {
    it('fetches every page and concatenates the items', async () => {
      const firstPage: PagedResource<string> = { totalPages: 3, items: ['first'] };
      const secondPage: PagedResource<string> = { totalPages: 3, items: ['second'] };
      const thirdPage: PagedResource<string> = { totalPages: 3, items: ['third'] };
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(jsonResponse(firstPage))
        .mockResolvedValueOnce(jsonResponse(secondPage))
        .mockResolvedValueOnce(jsonResponse(thirdPage));

      const result = await fetchAllPages<string>(
        'https://trails.local/api/resources?filter=active',
        50,
        'access-token',
      );

      expect(result).toEqual(['first', 'second', 'third']);
    });

    it('requests pages with page and size query parameters', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(jsonResponse<PagedResource<string>>({ totalPages: 2, items: [] }))
        .mockResolvedValueOnce(jsonResponse<PagedResource<string>>({ totalPages: 2, items: [] }));

      await fetchAllPages<string>('https://trails.local/api/resources?filter=active', 25, null);

      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        'https://trails.local/api/resources?filter=active&page=1&size=25',
        {
          headers: {},
        },
      );
    });

    it('adds pagination to a URL without query parameters', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(jsonResponse<PagedResource<string>>({ totalPages: 1, items: [] }));

      await fetchAllPages<string>('https://trails.local/api/resources', 25, null);

      expect(fetchSpy).toHaveBeenCalledWith('https://trails.local/api/resources?page=0&size=25', {
        headers: {},
      });
    });

    it('replaces existing pagination parameters', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(jsonResponse<PagedResource<string>>({ totalPages: 1, items: [] }));

      await fetchAllPages<string>('https://trails.local/api/resources?page=9&size=2', 25, null);

      expect(fetchSpy).toHaveBeenCalledWith('https://trails.local/api/resources?page=0&size=25', {
        headers: {},
      });
    });

    it('rejects malformed page responses', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ items: 'not-an-array' }));

      await expect(
        fetchAllPages<string>('https://trails.local/api/resources', 25, null),
      ).rejects.toThrow('malformed paged response');
    });

    it('throws the server-provided error message when page loading fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        jsonResponse(
          {
            detail: 'Applications could not be loaded.',
          },
          { status: 500 },
        ),
      );

      const result = fetchAllPages<string>('https://trails.local/api/applications?', 50, null);

      await expect(result).rejects.toThrow('Applications could not be loaded.');
    });
  });

  describe('putElement', () => {
    it('sends the element definition as JSON', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(jsonResponse<PersistedElement>({ id: 42 }));
      const definition: ElementDefinition = {
        type: 'BUTTON',
        label: 'Checkout',
        locatorString: '#checkout',
        locatorType: 'CSS',
      };

      await putElement(
        'https://trails.local/api/applications/7/stages/8/elements',
        definition,
        'access-token',
      );

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://trails.local/api/applications/7/stages/8/elements',
        {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer access-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(definition),
        },
      );
    });

    it('returns the persisted element', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse<PersistedElement>({ id: 42 }));

      const result = await putElement(
        'https://trails.local/api/applications/7/stages/8/elements',
        {
          type: 'BUTTON',
          label: 'Checkout',
          locatorString: '#checkout',
          locatorType: 'CSS',
        },
        null,
      );

      expect(result).toEqual({ id: 42 });
    });

    it('throws the server-provided error message when creation fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        jsonResponse(
          {
            message: 'Element label already exists.',
          },
          { status: 409 },
        ),
      );

      const result = putElement(
        'https://trails.local/api/applications/7/stages/8/elements',
        {
          type: 'BUTTON',
          label: 'Checkout',
          locatorString: '#checkout',
          locatorType: 'CSS',
        },
        null,
      );

      await expect(result).rejects.toThrow('Element label already exists.');
    });
  });

  it('follows advertised next links and preserves link query parameters', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          items: ['one'],
          totalPages: 2,
          _links: { next: { href: '/api/items?page=1&size=25' } },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: ['two'], totalPages: 2, _links: {} }));

    await expect(
      fetchAllPagesWithLinks('https://trails.local/api/items', 25, null),
    ).resolves.toEqual(expect.objectContaining({ items: ['one', 'two'] }));
    expect(fetchSpy.mock.calls[1][0]).toBe('https://trails.local/api/items?page=1&size=25');
  });

  it('resolves relative links and rejects unsafe or unsupported links', () => {
    expect(
      resolveResourceLink(
        'https://trails.local',
        { _links: { stages: { href: '/api/applications/1/stages' } } },
        'stages',
        'GET',
      ),
    ).toBe('https://trails.local/api/applications/1/stages');
    expect(() =>
      resolveResourceLink(
        'https://trails.local',
        { _links: { stages: { href: 'https://evil.local/stages' } } },
        'stages',
        'GET',
      ),
    ).toThrow('outside the Trails service');
    expect(() =>
      resolveResourceLink(
        'https://trails.local',
        { _links: { create: { href: '/api/elements', method: 'GET' } } },
        'create',
        'PUT',
      ),
    ).toThrow('does not support PUT');
  });
});
