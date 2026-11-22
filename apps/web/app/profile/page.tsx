"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getCurrentUser, getProfile } from "../../lib/auth";
import { getGameHistory } from "../../lib/games";
import GameHistoryList from "../../components/profile/GameHistoryList";

import type { AuthProfile } from "../../lib/auth";
import type { GameHistoryItem } from "../../lib/games";

function profileInitials(username: string): string {
  return username
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [games, setGames] = useState<GameHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const user = await getCurrentUser();

        if (user.kind !== "registered") {
          router.replace("/");
          return;
        }

        const [data, history] = await Promise.all([
          getProfile(),
          getGameHistory(),
        ]);

        if (active) {
          setProfile(data);
          setGames(history);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load your profile",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#151b1d] text-[#efe9d0]">
        Loading your profile...
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#151b1d] px-5 py-10 text-[#efe9d0]">
      <div className="w-full max-w-4xl space-y-6">
        <section className="rounded-2xl border border-white/10 bg-[#20272a] p-8 shadow-2xl">
          <div className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.4em] text-[#c9a968]">
              SMOTHERED
            </p>
            <h1 className="text-3xl font-semibold">Your Profile</h1>
            <p className="mt-2 text-sm text-[#a9b0ae]">
              Your account and player information.
            </p>
          </div>

          {profile ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div
                  aria-label={`${profile.username} avatar`}
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-[#c9a968]/50 bg-[#c9a968]/15 text-2xl font-semibold text-[#dfc181]"
                >
                  {profileInitials(profile.username)}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-semibold">
                    {profile.username}
                  </h2>
                  <p className="truncate text-sm text-[#a9b0ae]">
                    {profile.email}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/15 p-4">
                  <p className="text-xs uppercase tracking-wide text-[#7f8b88]">
                    Country
                  </p>
                  <p className="mt-1 text-sm text-[#efe9d0]">
                    {profile.country || "Not provided"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/15 p-4">
                  <p className="text-xs uppercase tracking-wide text-[#7f8b88]">
                    Date of birth
                  </p>
                  <p className="mt-1 text-sm text-[#efe9d0]">
                    {profile.dateOfBirth || "Not provided"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/15 p-4">
                <p className="text-xs uppercase tracking-wide text-[#7f8b88]">
                  About
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#c4cbc7]">
                  {profile.bio || "No bio added yet."}
                </p>
              </div>
            </div>
          ) : (
            error && (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            )
          )}

          <Link
            href="/"
            className="mt-6 block text-center text-sm text-[#c9a968] hover:text-[#dfc181]"
          >
            ← Back to dashboard
          </Link>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#20272a] p-8 shadow-2xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#c9a968]">
                History
              </p>
              <h2 className="text-2xl font-semibold">Your games</h2>
              <p className="mt-2 text-sm text-[#a9b0ae]">
                Your latest games against registered players.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-[#a9b0ae]">
              {games.length} {games.length === 1 ? "game" : "games"}
            </span>
          </div>

          <GameHistoryList games={games} />
        </section>
      </div>
    </main>
  );
}
