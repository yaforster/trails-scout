import type { ElementDefinition, PagedResource, PersistedElement } from './types';
import { readErrorMessage, readJsonResponse } from './utils';

export async function fetchAllPages<T>(
  baseUrl: string,
  pageSize: number,
  accessToken: string | null,
): Promise<T[]> {
  const firstPage = await fetchPage<T>(`${baseUrl}&page=0&size=${pageSize}`, accessToken);
  const totalPages = firstPage.totalPages ?? 1;
  const items = [...(firstPage.items ?? [])];

  for (let page = 1; page < totalPages; page++) {
    const nextPage = await fetchPage<T>(`${baseUrl}&page=${page}&size=${pageSize}`, accessToken);
    items.push(...(nextPage.items ?? []));
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

  return result;
}

function buildJsonHeaders(accessToken: string | null): HeadersInit {
  return {
    ...buildAuthorizationHeaders(accessToken),
    'Content-Type': 'application/json',
  };
}
