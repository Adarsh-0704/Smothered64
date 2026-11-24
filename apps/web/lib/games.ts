import { AuthError, clearStoredAuthToken } from "./auth";

const API_URL =
  process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:3001";

export interface GameHistoryItem {
  id: string;
  opponent: {
    id: string;
    displayName: string;
  };
  color: "white" | "black";
  result: "white_win" | "black_win" | "draw" | null;
  status: "completed" | "abandoned" | "cancelled";
  terminationReason: string | null;
  moveCount: number;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

interface GameHistoryResponse {
  games: GameHistoryItem[];
}

export async function getGameHistory(): Promise<GameHistoryItem[]> {
  const response = await fetch(`${API_URL}/api/v1/games/history`, {
    method: "GET",
    credentials: "include",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
        ? data.message
        : "Could not load game history";

    if (response.status === 401) {
      clearStoredAuthToken();
    }

    throw new AuthError(message, response.status);
  }

  return (data as GameHistoryResponse).games;
}
