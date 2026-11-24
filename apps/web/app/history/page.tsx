"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getCurrentUser, isUnauthorizedError } from "../../lib/auth";
import { getGameHistory } from "../../lib/games";
import type { GameHistoryItem } from "../../lib/games";
import GameHistoryList from "../../components/profile/GameHistoryList";

export default function HistoryPage() {
  const router = useRouter();
  const [games, setGames] = useState<GameHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const user = await getCurrentUser();

        if (user.kind !== "registered") {
          router.replace("/login");
          return;
        }

        const history = await getGameHistory();

        if (active) {
          setGames(history);
        }
      } catch (err) {
        if (active) {
          if (isUnauthorizedError(err)) {
            router.replace("/login");
            return;
          }

          setError(err instanceof Error ? err.message : "Could not load game history");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#151b1d] text-[#efe9d0]">
        Loading your game history...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#151b1d] px-5 py-10 text-[#efe9d0] sm:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/" className="text-xs font-semibold uppercase tracking-[0.4em] text-[#c9a968]">
              Smothered
            </Link>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-[#c9a968]">
              History
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Your games</h1>
            <p className="mt-2 text-sm text-[#a9b0ae]">
              Every registered-player match, all in one place.
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/profile" className="rounded-full border border-white/15 px-4 py-2 text-[#c4cbc7] hover:bg-white/10">
              Profile
            </Link>
            <Link href="/play" className="rounded-full bg-[#c9a968] px-4 py-2 font-semibold text-[#151b1d] hover:bg-[#dfc181]">
              Play
            </Link>
          </div>
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#20272a] p-6 shadow-2xl sm:p-8">
          {error ? (
            <p role="alert" className="text-sm text-red-300">{error}</p>
          ) : (
            <GameHistoryList games={games} />
          )}
        </section>
      </div>
    </main>
  );
}
