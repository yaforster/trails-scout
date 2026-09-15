export type StatusType = 'idle' | 'success' | 'error';
export type TokenStatusType = 'pending' | 'success' | 'error';
export type TabId = 'auth' | 'target' | 'element';
export type LocatorType = 'CSS' | 'XPATH';

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
  cssSelector: string;
  xpath: string;
  selectedAt: string;
}

export interface PopupSettings {
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
}

export interface ApplicationResource {
  id?: number;
  label?: string;
}

export interface StageResource {
  id?: number;
  label?: string;
}

export interface PagedResource<T> {
  items?: T[];
  totalPages?: number;
}

export interface KeycloakTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  error?: string;
  error_description?: string;
}
