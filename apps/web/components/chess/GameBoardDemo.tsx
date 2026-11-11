"use client";

import { useEffect, useState } from "react";
import { GameClient } from "@smothered/client";
import ChessBoard from "./ChessBoard";

export default function GameBoardDemo() {
  const [gameClient, setGameClient] = useState<GameClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [matchStatus, setMatchStatus] = useState("Creating guest session…");

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

    async function startGuestSession() {
      const serverUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:3001";
      const storedToken = window.localStorage.getItem("smothered:guest-token");
      const response = await fetch(`${serverUrl}/api/v1/auth/guest`, {
        method: "POST",
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : undefined,
      });
      if (!response.ok) throw new Error(`Guest session could not be created (${response.status})`);

      const payload = await response.json() as { token?: unknown };
      if (typeof payload.token !== "string") throw new Error("Guest session response did not include a token");
      window.localStorage.setItem("smothered:guest-token", payload.token);

      client = new GameClient(undefined, { socketOptions: { auth: { token: payload.token } } });
      removeOpenListener = client.on("open", () => {
        setConnected(true);
        setConnectionError(null);
      });
      removeCloseListener = client.on("close", () => setConnected(false));
      removeErrorListener = client.on("error", (error) => setConnectionError(error.message));
      removeWaitingListener = client.on("matchmakingWaiting", () => {
        setMatchStatus("Searching for an opponent…");
      });
      removeMatchFoundListener = client.on("matchFound", (match) => {
        setMatchStatus(`Matched as ${match.color} · ${match.opponent.displayName}`);
      });
      removeMatchEndedListener = client.on("matchEnded", () => {
        setMatchStatus("Searching for an opponent…");
      });
      removeGameOverListener = client.on("gameOver", () => {
        setMatchStatus("Game over");
      });

      if (!active) {
        client.disconnect();
        return;
      }
      setGameClient(client);
      await client.connect(serverUrl);
      client.send("matchmaking:join");
    }

    startGuestSession().catch((error: unknown) => {
      if (active) setConnectionError(error instanceof Error ? error.message : String(error));
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
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your game</h1>
            <p className="mt-2 text-sm text-[#a9b0ae]">
              Select a piece, then choose a highlighted square.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#c4cbc7]">
            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />
            {connected ? "Connected" : "Waiting for server"}
          </div>
        </div>
      </div>

      {gameClient ? (
        <ChessBoard gameClient={gameClient} />
      ) : (
        <div className="flex aspect-square w-[min(88vw,720px)] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm text-[#a9b0ae]">
          Creating guest session…
        </div>
      )}

      <p className="mt-6 max-w-[720px] text-center text-xs leading-5 text-[#7f8b88]">
        {connectionError ?? (connected ? matchStatus : "Creating guest session…")}
      </p>
    </main>
  );
}
