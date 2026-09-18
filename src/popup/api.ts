import type {
  ElementDefinition,
  PagedResource,
  PersistedElement,
  ResourceLink,
  ResourceLinks,
} from './types';
import { readErrorMessage, readJsonResponse } from './utils';

export async function fetchAllPages<T>(
  baseUrl: string,
  pageSize: number,
  accessToken: string | null,
): Promise<T[]> {
  return (await fetchAllPagesWithLinks(baseUrl, pageSize, accessToken)).items;
}

export async function fetchAllPagesWithLinks<T>(
  baseUrl: string,
  pageSize: number,
  accessToken: string | null,
): Promise<{ items: T[]; links: ResourceLinks }> {
  let pageUrl = buildPageUrl(baseUrl, 0, pageSize);
  let pageNumber = 0;
  const items: T[] = [];
  let links: ResourceLinks = {};

  while (true) {
    const page = await fetchPage<T>(pageUrl, accessToken);
    items.push(...page.items);
    const pageLinks = page._links ?? {};
    links = { ...links, ...pageLinks };

    const nextHref = pageLinks.next?.href?.trim();
    if (nextHref && pageNumber + 1 < page.totalPages) {
      pageUrl = resolveLink(baseUrl, { href: nextHref }, 'next', 'GET');
      pageNumber += 1;
      continue;
    }

    if (pageNumber + 1 >= page.totalPages) {
      return { items, links };
    }

    pageNumber += 1;
    pageUrl = buildPageUrl(baseUrl, pageNumber, pageSize);
  }
}

export function resolveResourceLink(
  serviceUrl: string,
  resource: { _links?: ResourceLinks } | undefined,
  relation: string,
  expectedMethod: string,
): string {
  const link = resource?._links?.[relation];
  return resolveLink(serviceUrl, link, relation, expectedMethod);
}

function resolveLink(
  serviceUrl: string,
  link: ResourceLink | undefined,
  relation: string,
  expectedMethod: string,
): string {
  if (!link?.href?.trim()) {
    throw new Error(`Resource link "${relation}" is unavailable.`);
  }
  if (link.templated || link.href.includes('{')) {
    throw new Error(`Resource link "${relation}" is templated and cannot be followed.`);
  }
  if (link.method && link.method.toUpperCase() !== expectedMethod.toUpperCase()) {
    throw new Error(`Resource link "${relation}" does not support ${expectedMethod}.`);
  }

  const base = new URL(serviceUrl);
  const resolved = new URL(link.href.trim(), base);
  if (resolved.origin !== base.origin) {
    throw new Error(`Resource link "${relation}" points outside the Trails service.`);
  }

  return resolved.toString();
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
  createElementHref: string,
  definition: ElementDefinition,
  accessToken: string | null,
): Promise<PersistedElement> {
  const response = await fetch(createElementHref, {
    method: 'PUT',
    headers: buildJsonHeaders(accessToken),
    body: JSON.stringify(definition),
  });

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
