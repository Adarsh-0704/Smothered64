"use client";

import { useEffect, useState } from "react";
import { GameClient } from "@smothered/client";
import type { GameClientState } from "@smothered/client";
import { GameStatus as GameStatusValue } from "@smothered/chess_rule_engine";
import ChessBoard from "./ChessBoard";
import type { AuthUser } from "../../lib/auth";
import Link from "next/link";
import AccountMenu from "../navigation/AccountMenu";

interface GameBoardDemoProps {
  user: AuthUser;
  onLogout: () => void;
}

type PlayerColor = "white" | "black";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function colorName(color: PlayerColor | null): string {
  return color ? `${color[0].toUpperCase()}${color.slice(1)}` : "—";
}

function PlayerCard({
  name,
  color,
  label,
  active,
  status,
  statusTone,
  waiting = false,
}: {
  name: string;
  color: PlayerColor | null;
  label: string;
  active: boolean;
  status: string;
  statusTone: "good" | "warn" | "bad";
  waiting?: boolean;
}) {
  const statusColor = statusTone === "good"
    ? "bg-emerald-400"
    : statusTone === "bad"
      ? "bg-rose-400"
      : "bg-amber-400";

  return (
    <div
      className={`border px-4 py-4 text-center transition ${
        active
          ? "border-[#d9b76e] border-l-4 border-l-[#e1ba61] bg-[#c9a968]/15 shadow-[0_0_24px_rgb(201_169_104_/_0.12)]"
          : "border-white/8 bg-white/[0.035]"
      }`}
    >
      <div className="flex min-w-0 flex-col items-center">
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold tracking-wide ${
            color === "white"
              ? "bg-[#f2ead8] text-[#26302f]"
              : color === "black"
                ? "bg-[#2b3435] text-[#e6d7b4] ring-1 ring-white/10"
                : "bg-[#2b3435] text-[#8c9994] ring-1 ring-white/10"
          }`}
        >
          {waiting ? "…" : initials(name)}
        </div>
        <p className="mt-3 truncate text-sm font-semibold text-[#f4edda]">{name}</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[#7f8b88]">
          {label} · {colorName(color)}
        </p>
        {active && (
          <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#e1ba61]">
            Current turn
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 border-t border-white/8 pt-3 text-xs text-[#a9b0ae]">
        <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
        <span>{status}</span>
      </div>
    </div>
  );
}

export default function GameBoardDemo({ user, onLogout }: GameBoardDemoProps) {
  const [gameClient, setGameClient] = useState<GameClient | null>(null);
  const [gameState, setGameState] = useState<GameClientState | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [reconnectDeadline, setReconnectDeadline] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    let client: GameClient | null = null;
    let removeOpenListener = () => {};
    let removeCloseListener = () => {};
    let removeErrorListener = () => {};
    let removeMatchFoundListener = () => {};
    let removeMatchEndedListener = () => {};
    let removeGameOverListener = () => {};
    let removeOpponentDisconnectedListener = () => {};
    let removeOpponentReconnectedListener = () => {};
    let removeStateListener = () => {};

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

      removeStateListener = client.on("state", (nextState) => {
        setGameState(nextState);
      });

      removeMatchFoundListener = client.on("matchFound", (match) => {
        setOpponentName(match.opponent.displayName);
      });

      removeMatchEndedListener = client.on("matchEnded", () => {
        setOpponentName(null);
        setReconnectDeadline(null);
        setSecondsRemaining(null);
      });

      removeGameOverListener = client.on("gameOver", () => {
        setReconnectDeadline(null);
        setSecondsRemaining(null);
      });

      removeOpponentDisconnectedListener = client.on("opponentDisconnected", (payload) => {
        setReconnectDeadline(Date.parse(payload.reconnectDeadline));
      });

      removeOpponentReconnectedListener = client.on("opponentReconnected", () => {
        setReconnectDeadline(null);
        setSecondsRemaining(null);
      });

      if (!active) {
        client.disconnect();
        return;
      }

      setGameClient(client);
      setGameState(client.getState());

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
      removeMatchFoundListener();
      removeMatchEndedListener();
      removeGameOverListener();
      removeOpponentDisconnectedListener();
      removeOpponentReconnectedListener();
      removeStateListener();
      client?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (reconnectDeadline === null) return;

    const updateCountdown = () => {
      setSecondsRemaining(Math.max(0, Math.ceil((reconnectDeadline - Date.now()) / 1000)));
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(timer);
  }, [reconnectDeadline]);

  const playerColor = gameState?.playerColor ?? null;
  const opponentColor: PlayerColor | null = playerColor === null
    ? null
    : playerColor === "white" ? "black" : "white";
  const moveCount = gameClient?.getGame().moveHistory.length ?? 0;
  const opponentStatus = !opponentName
    ? { label: "Searching for opponent", tone: "warn" as const }
    : reconnectDeadline !== null
      ? { label: "Disconnected", tone: "bad" as const }
      : { label: "Connected", tone: "good" as const };
  const playerStatus = connectionError
    ? { label: "Connection issue", tone: "bad" as const }
    : connected
      ? { label: "Connected", tone: "good" as const }
      : { label: "Connecting", tone: "warn" as const };
  const isGameOver = gameState?.status === GameStatusValue.WHITE_WON ||
    gameState?.status === GameStatusValue.BLACK_WON ||
    gameState?.status === GameStatusValue.DRAW;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#101719] px-4 pb-6 pt-3 text-[#efe9d0] sm:px-6 lg:h-screen lg:min-h-0 lg:overflow-hidden lg:px-8 lg:pb-4">
      <div className="pointer-events-none absolute -left-40 top-24 h-96 w-96 rounded-full bg-[#c9a968]/[0.06] blur-3xl" />
      <div className="pointer-events-none absolute right-[-14rem] top-[-8rem] h-[34rem] w-[34rem] rounded-full bg-[#3c6c68]/[0.11] blur-3xl" />

      <div className="relative mx-auto flex h-full w-full max-w-[1480px] flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-white/8 pb-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#c9a968] text-sm font-black text-[#182022] shadow-[0_8px_24px_rgb(201_169_104_/_0.18)]">
              S
            </span>
            <span className="text-sm font-bold uppercase tracking-[0.28em] text-[#e5d7b7]">
              Smothered
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 border-l border-white/10 pl-3 text-xs text-[#9ca8a4] sm:flex">
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />
              {connected ? "Live room" : "Connecting"}
            </div>
            <AccountMenu onLogout={onLogout} user={user} />
          </div>
        </header>

        <div className="mt-4 grid min-h-0 flex-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-stretch">
          <aside className="flex min-h-0 flex-col justify-center gap-4 lg:py-10">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#c9a968]">Live match room</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#f4edda]">Make your move.</h1>
            </div>

            <PlayerCard
              name={opponentName ?? "Waiting for opponent"}
              color={opponentColor}
              label="Opponent"
              active={gameState?.turn === opponentColor}
              status={opponentStatus.label}
              statusTone={opponentStatus.tone}
              waiting={!opponentName}
            />

            {reconnectDeadline !== null && (
              <div className="border border-rose-300/30 bg-rose-400/[0.06] px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-200">
                  Opponent disconnected
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-[#f4edda]">
                  {secondsRemaining ?? 0}s
                </p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#a9b0ae]">
                  until abandonment
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.24em] text-[#66736f]">
              <span className="h-px flex-1 bg-white/10" />
              <span>vs</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <PlayerCard
              name={user.displayName}
              color={playerColor}
              label="You"
              active={gameState?.turn === playerColor && playerColor !== null}
              status={playerStatus.label}
              statusTone={playerStatus.tone}
            />

            <div className="flex shrink-0 justify-center gap-2 px-1 pt-1">
              <Link href="/" className="border border-white/10 px-3 py-1.5 text-xs text-[#a9b0ae] transition hover:border-white/25 hover:bg-white/8 hover:text-white">Dashboard</Link>
              {user.kind === "registered" && (
                <Link href="/profile" className="border border-[#c9a968]/35 px-3 py-1.5 text-xs text-[#d1b374] transition hover:bg-[#c9a968]/10">My profile</Link>
              )}
            </div>
          </aside>

          <section className="relative flex min-h-0 min-w-0 flex-col border border-white/10 bg-[#1b2425]/90 p-3 shadow-[0_24px_80px_rgb(0_0_0_/_0.24)] sm:p-4">
            <div className="flex min-h-0 flex-1 items-center justify-center py-2">
              {gameClient ? (
                <ChessBoard gameClient={gameClient} className="w-full max-w-[min(80vh,820px)]" />
              ) : (
                <div className="flex aspect-square w-full max-w-[min(80vh,820px)] items-center justify-center border border-white/10 bg-[#24302e] text-sm text-[#a9b0ae]">
                  <span className="animate-pulse">Preparing your board…</span>
                </div>
              )}
            </div>
            {!isGameOver && gameClient && gameState?.playerColor !== null && (
              <div className="absolute bottom-3 left-3 z-[5] border border-white/10 bg-[#172021]/95 p-1.5 shadow-lg sm:bottom-4 sm:left-4">
                <button
                  type="button"
                  aria-label="Resign game"
                  title="Resign game"
                  onClick={() => {
                    if (window.confirm("Resign this game? This cannot be undone."))
                      gameClient.resign();
                  }}
                  className="grid h-8 w-8 place-items-center text-[#a9b0ae] transition hover:bg-white/10 hover:text-[#efe9d0] focus-visible:outline-2 focus-visible:outline-[#c9a968]"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M5.25 20.5V4.75" />
                    <path d="M3.75 20.5h3" />
                    <path d="M5.25 4.75c3.2-1.1 6.1 1.7 9.3.55l2.2-.8-1.85 3.15 1.85 3.05-2.2.8c-3.2 1.15-6.1-1.65-9.3-.55" fill="currentColor" fillOpacity="0.18" />
                    <path d="M7.2 5.15c2.7-.2 4.75 1.55 7.35.55" opacity="0.55" />
                  </svg>
                </button>
              </div>
            )}
            <span className="pointer-events-none absolute bottom-3 right-3 border border-white/10 bg-[#172021]/90 px-3 py-1.5 text-xs text-[#a9b0ae] shadow-lg sm:bottom-4 sm:right-4">
              Move {Math.max(1, Math.ceil(moveCount / 2))}
            </span>
          </section>
        </div>
      </div>
    </main>
  );
}
