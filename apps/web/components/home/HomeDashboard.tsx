"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getCurrentUser } from "../../lib/auth";
import type { AuthUser } from "../../lib/auth";
import { getGameHistory } from "../../lib/games";
import type { GameHistoryItem } from "../../lib/games";
import GameHistoryList from "../profile/GameHistoryList";

export default function HomeDashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [games, setGames] = useState<GameHistoryItem[]>([]);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const currentUser = await getCurrentUser();

        if (!active) return;

        setUser(currentUser);

        if (currentUser.kind === "registered") {
          const history = await getGameHistory();

          if (active) {
            setGames(history);
          }
        }
      } catch {
        // The home screen is also the public entry point, so unauthenticated
        // visitors can still see the play and sign-in actions.
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const isRegistered = user?.kind === "registered";
  const playHref = user ? "/play" : "/login";

  return (
    <main className="min-h-screen bg-[#151b1d] px-5 py-8 text-[#efe9d0] sm:px-8 sm:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-xs font-semibold uppercase tracking-[0.4em] text-[#c9a968]">
            Smothered
          </Link>
          <div className="flex items-center gap-3 text-sm text-[#a9b0ae]">
            {checking ? (
              <span>Loading...</span>
            ) : user ? (
              <span>Playing as {user.displayName}</span>
            ) : (
              <Link href="/login" className="text-[#c9a968] hover:text-[#dfc181]">
                Sign in
              </Link>
            )}
          </div>
        </header>

        <section className="mt-16 grid items-end gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-4 text-sm uppercase tracking-[0.3em] text-[#7f8b88]">
              Online chess, simply played
            </p>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
              Find your next move.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#a9b0ae] sm:text-lg">
              Jump into a live match, keep your games in one place, and make every move count.
            </p>
            <Link
              href={playHref}
              className="mt-8 inline-flex items-center justify-center rounded-full bg-[#c9a968] px-7 py-3.5 font-semibold text-[#151b1d] transition hover:bg-[#dfc181]"
            >
              {user ? "Play now" : "Play a game"}
              <span aria-hidden="true" className="ml-3 text-lg">→</span>
            </Link>
          </div>

          <div className="rounded-3xl border border-[#c9a968]/25 bg-[#20272a] p-6 shadow-2xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#c9a968]">
              Your space
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              {isRegistered ? "Keep your progress close." : "Make it yours."}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#a9b0ae]">
              {isRegistered
                ? "Review your player profile and look back at recent matches whenever you need a reset."
                : "Sign in to save your profile and build a history of every registered-player match."}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Link
                href={isRegistered ? "/profile" : "/login"}
                className="rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-[#c9a968]/50 hover:bg-[#c9a968]/10"
              >
                <span className="block text-sm font-semibold">Profile</span>
                <span className="mt-1 block text-xs text-[#7f8b88]">
                  {isRegistered ? "View your player details" : "Sign in to view your profile"}
                </span>
              </Link>
              <Link
                href={isRegistered ? "/history" : "/login"}
                className="rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-[#c9a968]/50 hover:bg-[#c9a968]/10"
              >
                <span className="block text-sm font-semibold">Game history</span>
                <span className="mt-1 block text-xs text-[#7f8b88]">
                  {isRegistered ? `${games.length} recorded ${games.length === 1 ? "game" : "games"}` : "Sign in to track your games"}
                </span>
              </Link>
            </div>
          </div>
        </section>

        {isRegistered && (
          <section className="mt-16 rounded-2xl border border-white/10 bg-[#20272a] p-6 sm:p-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#c9a968]">
                  Recent games
                </p>
                <h2 className="text-2xl font-semibold">Your latest matches</h2>
              </div>
              <Link href="/history" className="text-sm text-[#c9a968] hover:text-[#dfc181]">
                View all history →
              </Link>
            </div>
            <GameHistoryList games={games.slice(0, 3)} />
          </section>
        )}
      </div>
    </main>
  );
}
