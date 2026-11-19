
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import GameBoardDemo from "../chess/GameBoardDemo";

import {
  createGuestSession,
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from "../../lib/auth";

import type { AuthSession } from "../../lib/auth";

type AuthMode = "login" | "register";
const LEGACY_AUTH_TOKEN_KEY = "smothered:auth-token";

export default function AuthGate() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Restore a previously authenticated session.
  useEffect(() => {
  let active = true;

  async function restoreSession() {
    try {
      // First restore the session using the HTTP-only cookie.
      const user = await getCurrentUser();

      localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);

      if (active) {
        setSession({ user });
      }
    } catch {
      // Migrate an existing guest session from the previous implementation.
      const legacyToken = localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);

      if (legacyToken) {
        try {
          const data = await createGuestSession(legacyToken);

          localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);

          if (active) {
            setSession(data);
          }
        } catch {
          // Keep the legacy token if the server is unavailable.
        }
      }
    } finally {
      if (active) {
        setChecking(false);
      }
    }
  }

  void restoreSession();

  return () => {
    active = false;
  };
}, []);

  function saveSession(data: AuthSession) {
  setSession(data);
  setError("");
}

  // Handle registration and login.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);

    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const data =
        mode === "register"
          ? await registerUser(name, email, password)
          : await loginUser(email, password);

      saveSession(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Authentication failed",
      );
    } finally {
      setLoading(false);
    }
  }

  // Allow users to continue as guests.
  async function handleGuestLogin() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const data = await createGuestSession();
      saveSession(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create guest session",
      );
    } finally {
      setLoading(false);
    }
  }

  // Sign out.
  async function logout() {
  try {
    await logoutUser();

    setSession(null);
    setMode("login");
    setError("");
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Could not sign out",
    );
  }
}

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#151b1d] text-[#efe9d0]">
        Checking your session...
      </main>
    );
  }

  // Show the game after successful authentication.
  if (session) {
    return (
      <GameBoardDemo
  user={session.user}
  onLogout={logout}
/>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#151b1d] px-5 py-10 text-[#efe9d0]">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#20272a] p-8 shadow-2xl">

        <div className="mb-8 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.4em] text-[#c9a968]">
            SMOTHERED
          </p>

          <h1 className="text-3xl font-semibold">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>

          <p className="mt-2 text-sm text-[#a9b0ae]">
            {mode === "login"
              ? "Log in to continue playing chess."
              : "Create an account and start playing."}
          </p>
        </div>

        {/* Login / Register switch */}
        <div className="mb-6 grid grid-cols-2 rounded-lg bg-black/20 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`rounded-md py-2 text-sm ${
              mode === "login"
                ? "bg-[#c9a968] text-[#151b1d]"
                : "text-[#a9b0ae]"
            }`}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`rounded-md py-2 text-sm ${
              mode === "register"
                ? "bg-[#c9a968] text-[#151b1d]"
                : "text-[#a9b0ae]"
            }`}
          >
            Register
          </button>
        </div>

        {/* Authentication form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {mode === "register" && (
            <div>
              <label className="mb-2 block text-sm">
                Username
              </label>

              <input
                name="name"
                type="text"
                required
                maxLength={30}
                autoComplete="name"
                placeholder="Enter your name"
                className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[#c9a968]"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm">
              Email address
            </label>

            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[#c9a968]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm">
              Password
            </label>

            <input
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete={
                mode === "register"
                  ? "new-password"
                  : "current-password"
              }
              placeholder="Enter your password"
              className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[#c9a968]"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#c9a968] py-3 font-semibold text-[#151b1d] transition hover:bg-[#dfc181] disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : "Create account"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-[#7f8b88]">OR</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Guest access */}
        <button
          type="button"
          onClick={handleGuestLogin}
          disabled={loading}
          className="w-full rounded-lg border border-white/15 py-3 text-sm text-[#efe9d0] transition hover:bg-white/5 disabled:opacity-50"
        >
          Continue as guest
        </button>

        <p className="mt-6 text-center text-xs text-[#7f8b88]">
          Smothered Chess · Play. Compete. Improve.
        </p>
      </div>
    </main>
  );
}
