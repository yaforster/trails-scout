import type { LocatorCandidate, LocatorType } from '../locator-selectors';

export type { LocatorCandidate, LocatorType } from '../locator-selectors';

export type StatusType = 'idle' | 'success' | 'error';
export type Theme = 'light' | 'dark';
export type TokenStatusType = 'pending' | 'success' | 'error';
export type TabId = 'auth' | 'target' | 'element';

export type ElementType =
  | 'SELECT'
  | 'RADIO'
  | 'BUTTON'
  | 'TEXT'
  | 'INPUT'
  | 'CHECKBOX'
  | 'COLORPICKER'
  | 'DATEPICKER'
  | 'DATETIMEPICKER'
  | 'FILEUPLOAD'
  | 'RANGE'
  | 'TIME'
  | 'WEEK';

export interface SelectedLocator {
  candidates: LocatorCandidate[];
  selectedAt: string;
}

export interface PopupSettings {
  theme?: Theme;
  trailsServiceUrl?: string;
  keycloakUrl?: string;
  clientId?: string;
  clientSecret?: string;
  selectedApplicationId?: string;
  selectedStageId?: string;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
  refreshTokenExpiresAt?: number;
}

export interface ElementDefinition {
  type: ElementType;
  label: string;
  locatorString: string;
  locatorType: LocatorType;
}

export interface PersistedElement {
  id?: number;
  _links?: ResourceLinks;
}

export interface ElementResource {
  id?: number;
  type?: ElementType;
  label?: string;
  locatorString?: string;
  locatorType?: LocatorType;
  retired?: boolean;
  _links?: ResourceLinks;
}

export interface ApplicationResource {
  id?: number;
  label?: string;
  _links?: ResourceLinks;
}

export interface StageResource {
  id?: number;
  label?: string;
  _links?: ResourceLinks;
}

export interface PagedResource<T> {
  items?: T[];
  totalPages?: number;
  _links?: ResourceLinks;
}

export interface ResourceLink {
  href?: string;
  method?: string;
  templated?: boolean;
}

export type ResourceLinks = Record<string, ResourceLink | undefined>;

export interface KeycloakTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  error?: string;
  error_description?: string;
}
