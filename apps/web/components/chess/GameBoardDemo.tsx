"use client";

import { useEffect, useState } from "react";
import { GameClient } from "@smothered/client";
import ChessBoard from "./ChessBoard";

export default function GameBoardDemo() {
  const [gameClient] = useState(() => new GameClient());
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const removeOpenListener = gameClient.on("open", () => {
      setConnected(true);
      setConnectionError(null);
    });
    const removeCloseListener = gameClient.on("close", () => setConnected(false));
    const removeErrorListener = gameClient.on("error", (error) => {
      setConnectionError(error.message);
    });
    const serverUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL;

    if (serverUrl) {
      gameClient.connect(serverUrl).catch((error: unknown) => {
        setConnectionError(error instanceof Error ? error.message : String(error));
      });
    }

    return () => {
      removeOpenListener();
      removeCloseListener();
      removeErrorListener();
      gameClient.disconnect();
    };
  }, [gameClient]);

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

      <ChessBoard gameClient={gameClient} />

      <p className="mt-6 max-w-[720px] text-center text-xs leading-5 text-[#7f8b88]">
        {connectionError ?? "Set NEXT_PUBLIC_GAME_SERVER_URL to send moves through Socket.IO."}
      </p>
    </main>
  );
}
