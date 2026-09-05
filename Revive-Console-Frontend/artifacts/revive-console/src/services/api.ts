
export const apiBaseUrl = import.meta.env.VITE_API_URL;

const TOKEN_KEY = 'revive_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
};

export class ApiRequestError extends Error {
  readonly status: number | null;
  readonly data: unknown;

  constructor(message: string, status: number | null, data: unknown = null) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.data = data;
  }
}

/**
 * The only place the console talks to the API. Endpoint payloads remain
 * intentionally untyped until the backend contracts are available.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  if (!apiBaseUrl) {
    throw new ApiRequestError('VITE_API_URL is not configured.', null);
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const requestBody: BodyInit | undefined = isFormData
    ? options.body as FormData
    : options.body === undefined
      ? undefined
      : JSON.stringify(options.body);

  const headers: Record<string, string> = {};

  if (!isFormData && options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: requestBody,
      signal: options.signal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed.';
    throw new ApiRequestError(message, null);
  }

  const rawResponse = await response.text();
  let data: unknown = null;

  if (rawResponse) {
    try {
      data = JSON.parse(rawResponse);
    } catch {
      data = rawResponse;
    }
  }

  if (response.status === 401 || response.status === 403) {
    throw new ApiRequestError('Authentication is required for this request.', response.status, data);
  }

  if (!response.ok) {
    throw new ApiRequestError(`API request failed with status ${response.status}.`, response.status, data);
  }

  if (!rawResponse) {
    return undefined as T;
  }

  return data as T;
}

export function apiConnectionLabel() {
  return apiBaseUrl ? 'API endpoint configured' : 'API endpoint not configured';
}