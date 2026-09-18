import type { ElementDefinition, PagedResource, PersistedElement } from './types';
import { readErrorMessage, readJsonResponse } from './utils';

export async function fetchAllPages<T>(
  baseUrl: string,
  pageSize: number,
  accessToken: string | null,
): Promise<T[]> {
  const firstPage = await fetchPage<T>(buildPageUrl(baseUrl, 0, pageSize), accessToken);
  const totalPages = firstPage.totalPages;
  const items = [...firstPage.items];

  for (let page = 1; page < totalPages; page++) {
    const nextPage = await fetchPage<T>(buildPageUrl(baseUrl, page, pageSize), accessToken);
    items.push(...nextPage.items);
  }

  return items;
}

export async function testHealthEndpoint(
  trailsServiceUrl: string,
  accessToken: string | null,
): Promise<Response> {
  return fetch(`${trailsServiceUrl}/actuator/health`, {
    method: 'GET',
    headers: buildAuthorizationHeaders(accessToken),
  });
}

export async function putElement(
  trailsServiceUrl: string,
  applicationId: string,
  stageId: string,
  definition: ElementDefinition,
  accessToken: string | null,
): Promise<PersistedElement> {
  const response = await fetch(
    `${trailsServiceUrl}/api/applications/${applicationId}/stages/${stageId}/elements`,
    {
      method: 'PUT',
      headers: buildJsonHeaders(accessToken),
      body: JSON.stringify(definition),
    },
  );

  const result = await readJsonResponse<PersistedElement>(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(result, 'Element creation failed.'));
  }

  return result;
}

export function buildAuthorizationHeaders(accessToken: string | null): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function fetchPage<T>(url: string, accessToken: string | null): Promise<PagedResource<T>> {
  const response = await fetch(url, {
    headers: buildAuthorizationHeaders(accessToken),
  });
  const result = await readJsonResponse<PagedResource<T>>(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(result, 'Resource loading failed.'));
  }

  if (!isPagedResource<T>(result)) {
    throw new Error('Resource loading failed: malformed paged response.');
  }

  return result;
}

function buildPageUrl(baseUrl: string, page: number, pageSize: number): string {
  const url = new URL(baseUrl);
  url.searchParams.set('page', String(page));
  url.searchParams.set('size', String(pageSize));
  return url.toString();
}

function isPagedResource<T>(value: unknown): value is PagedResource<T> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const resource = value as { items?: unknown; totalPages?: unknown };
  return (
    Array.isArray(resource.items) &&
    typeof resource.totalPages === 'number' &&
    Number.isInteger(resource.totalPages) &&
    resource.totalPages >= 1
  );
}

function buildJsonHeaders(accessToken: string | null): HeadersInit {
  return {
    ...buildAuthorizationHeaders(accessToken),
    'Content-Type': 'application/json',
  };
}
