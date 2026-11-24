"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  clearStoredAuthToken,
  createGuestSession,
  getCurrentUser,
  loginUser,
  registerUser,
} from "../../lib/auth";

type AuthMode = "login" | "register";

function Brand() {
  return (
    <Link aria-label="Smothered home" className="auth-brand" href="/">
      <span className="auth-brand-mark">S</span>
      <span>Smothered</span>
    </Link>
  );
}

function BoardMark() {
  return (
    <svg aria-hidden="true" className="auth-board-mark" viewBox="0 0 24 24" fill="none">
      <path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 8h16M4 12h16M4 16h16M8 4v16M12 4v16M16 4v16" stroke="currentColor" strokeOpacity=".45" />
      <path d="M4 4h4v4H4zM12 4h4v4h-4zM8 8h4v4H8zM16 8h4v4h-4zM4 12h4v4H4zM12 12h4v4h-4zM8 16h4v4H8zM16 16h4v4h-4z" fill="currentColor" fillOpacity=".7" />
    </svg>
  );
}

export default function AuthGate({ initialMode = "login" }: { initialMode?: AuthMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const currentUser = await getCurrentUser();
        clearStoredAuthToken();

        if (currentUser.kind === "registered" && active) {
          router.replace("/play");
        }
        return;
      } catch {
        clearStoredAuthToken();
      } finally {
        if (active) setChecking(false);
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, [router]);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
  }

  function finishAuthentication() {
    setError("");
    router.replace("/play");
  }

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
      if (mode === "register") {
        await registerUser(name, email, password);
      } else {
        await loginUser(email, password);
      }
      finishAuthentication();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGuestLogin() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      await createGuestSession();
      finishAuthentication();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create guest session");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="auth-page auth-loading-page">
        <Brand />
        <p>Checking your session...</p>
      </main>
    );
  }

  const isLogin = mode === "login";

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-top" />
      <div className="auth-glow auth-glow-bottom" />

      <div className="auth-layout">
        <section className="auth-intro">
          <div className="auth-intro-top">
            <Brand />
            <Link className="auth-back-link" href="/">
              Back to home
              <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          <div className="auth-intro-copy">
            <p className="auth-kicker"><span /> Smothered chess</p>
            <h1>
              {isLogin ? (
                <>Welcome <em>back.</em></>
              ) : (
                <>Make your mark<br /><em>on the board.</em></>
              )}
            </h1>
            <p>
              {isLogin
                ? "Your next game is closer than you think."
                : "Set up your player profile and make every move count."}
            </p>
          </div>

          <div className="auth-intro-footer">
            <BoardMark />
            <span>Play with intention.</span>
          </div>
        </section>

        <section aria-label={isLogin ? "Log in" : "Create an account"} className="auth-card">
          <div className="auth-card-heading">
            <div>
              <p className="auth-card-eyebrow">{isLogin ? "Player login" : "New player"}</p>
              <h2>{isLogin ? "Good to see you." : "Join the board."}</h2>
            </div>
            <span className="auth-step">01 <i /> 01</span>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              aria-selected={isLogin}
              className={isLogin ? "is-active" : ""}
              onClick={() => changeMode("login")}
              role="tab"
              type="button"
            >
              Log in
            </button>
            <button
              aria-selected={!isLogin}
              className={!isLogin ? "is-active" : ""}
              onClick={() => changeMode("register")}
              role="tab"
              type="button"
            >
              Register
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "register" && (
              <div className="auth-field">
                <label htmlFor="auth-name">Username</label>
                <input id="auth-name" name="name" type="text" required maxLength={30} autoComplete="name" placeholder="How should we call you?" />
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="auth-email">Email address</label>
              <input id="auth-email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
            </div>

            <div className="auth-field">
              <div className="auth-label-row">
                <label htmlFor="auth-password">Password</label>
                {isLogin && <span>Min. 8 characters</span>}
              </div>
              <input id="auth-password" name="password" type="password" required minLength={8} maxLength={128} autoComplete={isLogin ? "current-password" : "new-password"} placeholder="Enter your password" />
            </div>

            {error && <p className="auth-error" role="alert">{error}</p>}

            <button className="auth-submit" disabled={loading} type="submit">
              <span>{loading ? "Please wait..." : isLogin ? "Log in to play" : "Create account"}</span>
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                <path d="M4 16 16 4M7 4h9v9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>

          <button className="auth-guest" disabled={loading} onClick={handleGuestLogin} type="button">
            Continue as guest
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <p className="auth-card-footnote">
            {isLogin ? "New to Smothered?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => changeMode(isLogin ? "register" : "login")}>
              {isLogin ? "Create one" : "Log in"}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}
