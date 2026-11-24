export interface AuthUser {
  id: string;
  displayName: string;
  kind: "guest" | "registered";
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
}

export interface AuthProfile {
  userId: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null;
  dateOfBirth: string | null;
}

const LEGACY_AUTH_TOKEN_KEY = "smothered:auth-token";

export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export function clearStoredAuthToken(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof AuthError && error.status === 401;
}

export function getGameServerUrl(): string {
  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;

    // Keep localhost sessions same-site so HTTP-only cookies work during
    // local development, even when the LAN URL is configured in .env.local.
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return `${protocol}//${hostname}:3001`;
    }
  }

  return process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:3001";
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `${getGameServerUrl()}/api/v1/auth${endpoint}`,
    {
      ...options,
      credentials: "include",
    },
  );

  const data =
    response.status === 204
      ? undefined
      : await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
        ? data.message
        : "Authentication request failed";

    if (response.status === 401) {
      clearStoredAuthToken();
    }

    throw new AuthError(message, response.status);
  }

  return data as T;
}

export function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<AuthSession> {
  return request<AuthSession>("/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email, password }),
  });
}

export function loginUser(
  email: string,
  password: string,
): Promise<AuthSession> {
  return request<AuthSession>("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
}

export function createGuestSession(): Promise<AuthSession> {
  return request<AuthSession>("/guest", {
    method: "POST",
  });
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await request<{ user: AuthUser }>("/me", {
    method: "GET",
  });

  return response.user;
}

export function logoutUser(): Promise<void> {
  clearStoredAuthToken();

  return request<void>("/logout", {
    method: "POST",
  });
}

export async function getProfile(): Promise<AuthProfile> {
  const response = await request<{ profile: AuthProfile }>("/profile", {
    method: "GET",
  });

  return response.profile;
}

export async function updateProfile(
  updates: {
    username?: string;
    avatarUrl?: string | null;
    bio?: string | null;
    country?: string | null;
    dateOfBirth?: string | null;
  },
): Promise<AuthProfile> {
  const response = await request<{ profile: AuthProfile }>("/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });

  return response.profile;
}
