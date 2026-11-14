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
  id: string;
  userId: string;
  email: string;
  displayName: string;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

const API_URL =
  process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:3001";

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `${API_URL}/api/v1/auth${endpoint}`,
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

    throw new Error(message);
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

export function createGuestSession(
  legacyToken?: string,
): Promise<AuthSession> {
  return request<AuthSession>("/guest", {
    method: "POST",
    headers: legacyToken
      ? { Authorization: `Bearer ${legacyToken}` }
      : undefined,
  });
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await request<{ user: AuthUser }>("/me", {
    method: "GET",
  });

  return response.user;
}

export function logoutUser(): Promise<void> {
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
  updates: { displayName?: string; bio?: string | null },
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