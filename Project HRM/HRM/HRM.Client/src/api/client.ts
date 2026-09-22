import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse, TokenResponse } from './types';

const SESSION_KEY = 'hrm.session';

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAtUtc: string;
  user: TokenResponse['user'];
}

export const sessionStore = {
  read(): Session | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  },
  write(session: Session) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // A blocked storage API must not break the session for the current tab.
    }
  },
  clear() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  },
};

/** Raised for any non-2xx response, carrying the server's message and field errors. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors?: Record<string, string[]> | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The first validation message for a field, if the server returned one. */
  fieldError(field: string): string | undefined {
    if (!this.errors) return undefined;
    const key = Object.keys(this.errors).find((k) => k.toLowerCase() === field.toLowerCase());
    return key ? this.errors[key][0] : undefined;
  }
}

/** Notified when the session ends so the app can return the user to the login page. */
type SessionEndedHandler = () => void;
let onSessionEnded: SessionEndedHandler = () => {};
export const setSessionEndedHandler = (handler: SessionEndedHandler) => {
  onSessionEnded = handler;
};

export const http: AxiosInstance = axios.create({
  baseURL: '/',
  headers: { Accept: 'application/json' },
});

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const session = sessionStore.read();
  if (session?.accessToken) {
    config.headers.set('Authorization', `Bearer ${session.accessToken}`);
  }
  return config;
});

// A single refresh is shared by every request that gets a 401 at the same time, so a burst of
// parallel calls does not trigger a burst of refreshes.
let refreshInFlight: Promise<Session | null> | null = null;

async function refreshSession(): Promise<Session | null> {
  const current = sessionStore.read();
  if (!current?.refreshToken) return null;

  try {
    const response = await axios.post<ApiResponse<TokenResponse>>('/api/auth/refresh', {
      refreshToken: current.refreshToken,
    });

    const data = response.data.data;
    if (!data) return null;

    const session: Session = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAtUtc: data.expiresAtUtc,
      user: data.user,
    };

    sessionStore.write(session);
    return session;
  } catch {
    return null;
  }
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status ?? 0;

    // One silent refresh-and-retry, never on the auth endpoints themselves.
    if (
      status === 401 &&
      original &&
      !original._retried &&
      !original.url?.includes('/api/auth/login') &&
      !original.url?.includes('/api/auth/refresh')
    ) {
      original._retried = true;
      refreshInFlight ??= refreshSession().finally(() => {
        refreshInFlight = null;
      });

      const session = await refreshInFlight;
      if (session) {
        original.headers.set('Authorization', `Bearer ${session.accessToken}`);
        return http.request(original);
      }

      sessionStore.clear();
      onSessionEnded();
    }

    const payload = error.response?.data;
    const message =
      payload?.message ??
      (status === 0 ? 'The server could not be reached. Check that the API is running.' : undefined) ??
      defaultMessage(status);

    throw new ApiError(message, status, payload?.errors);
  },
);

function defaultMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Some of the details supplied are not valid.';
    case 401:
      return 'Please sign in to continue.';
    case 403:
      return 'You do not have permission to do that.';
    case 404:
      return 'That item could not be found.';
    case 409:
      return 'That action conflicts with the current state. Refresh and try again.';
    case 422:
      return 'Some of the details supplied could not be processed.';
    case 429:
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return status >= 500 ? 'Something went wrong on the server. Please try again.' : 'The request failed.';
  }
}

/** Unwraps the ApiResponse envelope and returns the payload. */
export async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const response = await promise;
  if (!response.data.success) {
    throw new ApiError(response.data.message, 400, response.data.errors);
  }
  return response.data.data as T;
}

/** Unwraps and returns both the payload and the server's message, for success toasts. */
export async function unwrapWithMessage<T>(
  promise: Promise<{ data: ApiResponse<T> }>,
): Promise<{ data: T; message: string }> {
  const response = await promise;
  if (!response.data.success) {
    throw new ApiError(response.data.message, 400, response.data.errors);
  }
  return { data: response.data.data as T, message: response.data.message };
}
