import { randomUUID } from "node:crypto";
import { DefaultBoard, Game } from "@smothered/chess_rule_engine";
import type { AuthenticatedSocket } from "../socket/socket-auth.js";

type PlayerColor = "white" | "black";

interface MatchFoundPayload {
    readonly matchId: string;
    readonly color: PlayerColor;
    readonly opponent: {
        readonly id: string;
        readonly displayName: string;
    };
}

interface Match {
    readonly id: string;
    readonly players: [AuthenticatedSocket, AuthenticatedSocket];
    readonly game: Game;
}

class MatchmakingService
{
    private waitingPlayer: AuthenticatedSocket | null = null;
    private readonly matches = new Map<string, Match>();
    private readonly matchIdsBySocketId = new Map<string, string>();

    public join(socket: AuthenticatedSocket): void
    {
        if (this.matchIdsBySocketId.has(socket.id)) {
            socket.emit("matchmaking:error", { message: "You are already in a match" });
            return;
        }

        if (this.waitingPlayer?.connected === false)
            this.waitingPlayer = null;

        if (!this.waitingPlayer) {
            this.waitingPlayer = socket;
            socket.emit("matchmaking:waiting");
            return;
        }

        const opponent = this.waitingPlayer;
        this.waitingPlayer = null;

        if (opponent.data.user.id === socket.data.user.id) {
            this.waitingPlayer = socket;
            socket.emit("matchmaking:error", { message: "A user cannot be matched with themself" });
            return;
        }

        this.createMatch(opponent, socket);
    }

    public leave(socket: AuthenticatedSocket): void
    {
        if (this.waitingPlayer?.id === socket.id) {
            this.waitingPlayer = null;
            socket.emit("matchmaking:left");
            return;
        }

        const matchId = this.matchIdsBySocketId.get(socket.id);
        if (!matchId) return;

        const match = this.matches.get(matchId);
        if (!match) return;

        const opponent = match.players.find(player => player.id !== socket.id);
        this.matches.delete(matchId);
        for (const player of match.players) {
            this.matchIdsBySocketId.delete(player.id);
            delete player.data.matchId;
            player.leave(this.roomName(matchId));
        }

        socket.emit("matchmaking:left");
        opponent?.emit("match-ended", { matchId, reason: "opponent-left" });
    }

    public disconnect(socket: AuthenticatedSocket): void
    {
        if (this.waitingPlayer?.id === socket.id) {
            this.waitingPlayer = null;
            return;
        }

        const matchId = this.matchIdsBySocketId.get(socket.id);
        if (!matchId) return;

        const match = this.matches.get(matchId);
        if (!match) return;

        const opponent = match.players.find(player => player.id !== socket.id);
        this.matches.delete(matchId);
        for (const player of match.players) {
            this.matchIdsBySocketId.delete(player.id);
            delete player.data.matchId;
        }

        opponent?.emit("match-ended", { matchId, reason: "opponent-disconnected" });
    }

    public getMatch(socket: AuthenticatedSocket): Match | null
    {
        const matchId = this.matchIdsBySocketId.get(socket.id);
        return matchId ? this.matches.get(matchId) ?? null : null;
    }

    public getPlayerColor(match: Match, socket: AuthenticatedSocket): PlayerColor | null
    {
        if (match.players[0].id === socket.id) return "white";
        if (match.players[1].id === socket.id) return "black";
        return null;
    }

    private createMatch(first: AuthenticatedSocket, second: AuthenticatedSocket): void
    {
        const matchId = randomUUID();
        const game = new Game();
        game.setBoardLayout(DefaultBoard);
        const match: Match = { id: matchId, players: [first, second], game };
        this.matches.set(matchId, match);
        this.matchIdsBySocketId.set(first.id, matchId);
        this.matchIdsBySocketId.set(second.id, matchId);
        first.data.matchId = matchId;
        second.data.matchId = matchId;

        const room = this.roomName(matchId);
        first.join(room);
        second.join(room);

        const firstPayload: MatchFoundPayload = {
            matchId,
            color: "white",
            opponent: { id: second.data.user.id, displayName: second.data.user.displayName }
        };
        const secondPayload: MatchFoundPayload = {
            matchId,
            color: "black",
            opponent: { id: first.data.user.id, displayName: first.data.user.displayName }
        };

        first.emit("match-found", firstPayload);
        second.emit("match-found", secondPayload);

        const gameState = {
            matchId,
            board: game.board.getStrLayout(),
            turn: game.currentTurnColor
        } as const;
        first.emit("game-state", gameState);
        second.emit("game-state", gameState);
    }

    private roomName(matchId: string): string
    {
        return `match:${matchId}`;
    }
}

export { MatchmakingService };
export type { Match, MatchFoundPayload, PlayerColor };
