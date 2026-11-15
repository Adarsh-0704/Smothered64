"use client";

import { useEffect, useState } from "react";
import { GameClient } from "@smothered/client";
import ChessBoard from "./ChessBoard";
import type { AuthUser } from "../../lib/auth";
import Link from "next/link";

interface GameBoardDemoProps {
  user: AuthUser;
  onLogout: () => void;
}

export default function GameBoardDemo({ user, onLogout }: GameBoardDemoProps) {
  const [gameClient, setGameClient] = useState<GameClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [matchStatus, setMatchStatus] = useState("Connecting to your game…");

  useEffect(() => {
    let active = true;
    let client: GameClient | null = null;
    let removeOpenListener = () => {};
    let removeCloseListener = () => {};
    let removeErrorListener = () => {};
    let removeWaitingListener = () => {};
    let removeMatchFoundListener = () => {};
    let removeMatchEndedListener = () => {};
    let removeGameOverListener = () => {};

    async function startGameSession() {
      const serverUrl =
        process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:3001";

      // Connect using the authenticated user's HTTP-only session cookie.
      client = new GameClient(undefined, {
        socketOptions: {
          withCredentials: true,
        },
      });

      removeOpenListener = client.on("open", () => {
        setConnected(true);
        setConnectionError(null);
      });

      removeCloseListener = client.on("close", () => {
        setConnected(false);
      });

      removeErrorListener = client.on("error", (error) => {
        setConnectionError(error.message);
      });

      removeWaitingListener = client.on("matchmakingWaiting", () =>
        setMatchStatus("Searching for an opponent..."),
      );

      removeMatchFoundListener = client.on("matchFound", (match) => {
        setMatchStatus(
          `Matched as ${match.color} · ${match.opponent.displayName}`,
        );
      });

      removeMatchEndedListener = client.on("matchEnded", () =>
        setMatchStatus("Searching for an opponent..."),
      );

      removeGameOverListener = client.on("gameOver", () =>
        setMatchStatus("Game over"),
      );

      if (!active) {
        client.disconnect();
        return;
      }

      setGameClient(client);

      await client.connect(serverUrl);

      client.send("matchmaking:join");
    }

    startGameSession().catch((error: unknown) => {
      if (active) {
        setConnectionError(
          error instanceof Error ? error.message : String(error),
        );
      }
    });

    return () => {
      active = false;
      removeOpenListener();
      removeCloseListener();
      removeErrorListener();
      removeWaitingListener();
      removeMatchFoundListener();
      removeMatchEndedListener();
      removeGameOverListener();
      client?.disconnect();
    };
  }, []);

  return (
    <main className="flex min-h-full flex-1 flex-col items-center px-5 py-10 text-[#efe9d0] sm:px-8 sm:py-14">
      <div className="mb-8 w-full max-w-[720px]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#c9a968]">
          Smothered
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Your game
            </h1>

            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-[#c4cbc7]">
                Playing as {user.displayName}
              </span>
              {user.kind === "registered" && (
                <Link
                  href="/profile"
                  className="rounded-full border border-[#c9a968]/50 px-4 py-2 text-xs text-[#c9a968] transition hover:bg-[#c9a968]/10"
                >
                  My Profile
                </Link>
              )}
              <button
                type="button"
                onClick={onLogout}
                className="rounded-full border border-white/15 px-4 py-2 text-xs hover:bg-white/10"
              >
                Sign out
              </button>
            </div>
            <p className="mt-2 text-sm text-[#a9b0ae]">
              Select a piece, then choose a highlighted square.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#c4cbc7]">
            <span
              className={`mr-2 inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`}
            />
            {connected ? "Connected" : "Waiting for server"}
          </div>
        </div>
      </div>

      {gameClient ? (
        <ChessBoard gameClient={gameClient} />
      ) : (
        <div className="flex aspect-square w-[min(88vw,720px)] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm text-[#a9b0ae]">
          Connecting to your game…
        </div>
      )}

      <p className="mt-6 max-w-[720px] text-center text-xs leading-5 text-[#7f8b88]">
        {connectionError ??
          (connected ? matchStatus : "Connecting to your game…")}
      </p>
    </main>
  );
}
