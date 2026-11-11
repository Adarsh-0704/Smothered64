import type { DefaultEventsMap, Socket } from "socket.io";
import type { GameResult, GameStatus, MoveQuery, Position } from "@smothered/chess_rule_engine";
import { userStore } from "../db/user-store.js";
import { verifyToken } from "../utils/jwt.js";
import type { PublicUser } from "../types/auth.js";

interface SocketData {
    user: PublicUser;
    matchId?: string;
}

interface ClientToServerEvents {
    "matchmaking:join": () => void;
    "matchmaking:leave": () => void;
    move: (move: MoveQuery<Position>) => void;
}

interface ServerToClientEvents {
    "session:ready": (payload: { user: PublicUser }) => void;
    "matchmaking:waiting": () => void;
    "matchmaking:left": () => void;
    "matchmaking:error": (payload: { message: string }) => void;
    "match-found": (payload: {
        matchId: string;
        color: "white" | "black";
        opponent: { id: string; displayName: string };
    }) => void;
    "match-ended": (payload: { matchId: string; reason: string }) => void;
    "game-state": (payload: {
        matchId: string;
        board: Array<Array<`${"w" | "b"}${"P" | "N" | "B" | "R" | "Q" | "K"}` | null>>;
        turn: "white" | "black";
    }) => void;
    move: (move: MoveQuery<Position>) => void;
    "game-over": (payload: { matchId: string; status: GameStatus; result: GameResult }) => void;
    "game-error": (payload: { message: string }) => void;
}

type AuthenticatedSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>;

function authenticateSocket(socket: Socket, next: (error?: Error) => void): void
{
    try {
        const auth = socket.handshake.auth as { token?: unknown };
        const authorization = socket.handshake.headers.authorization;
        const token = typeof auth.token === "string"
            ? auth.token
            : typeof authorization === "string" && authorization.startsWith("Bearer ")
                ? authorization.slice("Bearer ".length).trim()
                : null;

        if (!token) {
            next(new Error("Authentication token missing"));
            return;
        }

        const payload = verifyToken(token);
        const user = userStore.getById(payload.userId);
        if (!user) {
            next(new Error("Authenticated user not found"));
            return;
        }

        (socket as AuthenticatedSocket).data.user = user;
        next();
    }
    catch {
        next(new Error("Invalid or expired authentication token"));
    }
}

export { authenticateSocket };
export type { AuthenticatedSocket, ClientToServerEvents, ServerToClientEvents, SocketData };
