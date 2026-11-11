import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { MatchmakingService } from "../matchmaking/matchmaking.service.js";
import { authenticateSocket, type AuthenticatedSocket } from "./socket-auth.js";
import type { MoveQuery, Position } from "@smothered/chess_rule_engine";

function isMoveQuery(value: unknown): value is MoveQuery<Position>
{
    if (!value || typeof value !== "object") return false;
    const move = value as Record<string, unknown>;
    const isPosition = (position: unknown): position is Position => {
        if (!position || typeof position !== "object") return false;
        const value = position as Record<string, unknown>;
        return Number.isInteger(value.x) && Number.isInteger(value.y);
    };

    return isPosition(move.from) && isPosition(move.to) &&
        (move.promoteTo === undefined || typeof move.promoteTo === "string");
}

function createSocketServer(httpServer: HttpServer, webOrigin: string): {
    io: Server;
    matchmaking: MatchmakingService;
}
{
    const io = new Server(httpServer, {
        cors: {
            origin: webOrigin === "*" ? true : webOrigin,
            credentials: true
        }
    });
    const matchmaking = new MatchmakingService();

    io.use(authenticateSocket);
    io.on("connection", rawSocket => {
        const socket = rawSocket as AuthenticatedSocket;
        socket.emit("session:ready", { user: socket.data.user });

        socket.on("matchmaking:join", () => matchmaking.join(socket));
        socket.on("matchmaking:leave", () => matchmaking.leave(socket));
        socket.on("move", move => {
            if (!isMoveQuery(move)) {
                socket.emit("game-error", { message: "Invalid move payload" });
                return;
            }

            const match = matchmaking.getMatch(socket);
            const playerColor = match ? matchmaking.getPlayerColor(match, socket) : null;
            if (!match || !playerColor) {
                socket.emit("game-error", { message: "You are not in a match" });
                return;
            }

            if (match.game.currentTurnColor !== playerColor) {
                socket.emit("game-error", { message: `Wait for ${match.game.currentTurnColor}'s turn` });
                return;
            }

            const result = match.game.playMoveWithValidation(move);
            if (!result.executed) {
                socket.emit("game-error", { message: `Invalid move: ${result.result}` });
                return;
            }

            matchmaking.recordMove(match, move);
            for (const player of matchmaking.getConnectedPlayers(match)) player.emit("move", move);
        });
        socket.on("disconnect", () => matchmaking.disconnect(socket));
    });

    return { io, matchmaking };
}

export { createSocketServer };
