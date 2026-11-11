import { randomUUID } from "node:crypto";
import { DefaultBoard, Game } from "@smothered/chess_rule_engine";
import type { MoveQuery, Position } from "@smothered/chess_rule_engine";
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

interface MatchPlayer {
    readonly userId: string;
    readonly displayName: string;
    readonly color: PlayerColor;
    socket: AuthenticatedSocket | null;
}

interface Match {
    readonly id: string;
    readonly players: [MatchPlayer, MatchPlayer];
    readonly game: Game;
    readonly moveHistory: MoveQuery<Position>[];
}

class MatchmakingService
{
    private waitingPlayer: AuthenticatedSocket | null = null;
    private readonly matches = new Map<string, Match>();
    private readonly matchIdsBySocketId = new Map<string, string>();
    private readonly matchIdsByUserId = new Map<string, string>();

    public join(socket: AuthenticatedSocket): void
    {
        const existingMatchId = this.matchIdsByUserId.get(socket.data.user.id);
        if (existingMatchId) {
            const existingMatch = this.matches.get(existingMatchId);
            const player = existingMatch?.players.find(({ userId }) => userId === socket.data.user.id);

            if (existingMatch && player) {
                if (player.socket && player.socket.id !== socket.id && player.socket.connected) {
                    socket.emit("matchmaking:error", { message: "You are already in a match" });
                    return;
                }

                this.attachSocket(existingMatch, player, socket);
                this.sendMatchSnapshot(existingMatch, player);
                return;
            }

            this.matchIdsByUserId.delete(socket.data.user.id);
        }

        if (this.matchIdsBySocketId.has(socket.id)) {
            socket.emit("matchmaking:error", { message: "You are already in a match" });
            return;
        }

        if (this.waitingPlayer?.connected === false)
            this.waitingPlayer = null;

        if (this.waitingPlayer?.data.user.id === socket.data.user.id) {
            socket.emit("matchmaking:error", { message: "You are already searching for an opponent" });
            return;
        }

        if (!this.waitingPlayer) {
            this.waitingPlayer = socket;
            socket.emit("matchmaking:waiting");
            return;
        }

        const opponent = this.waitingPlayer;
        this.waitingPlayer = null;
        this.createMatch(opponent, socket);
    }

    public leave(socket: AuthenticatedSocket): void
    {
        if (this.waitingPlayer?.id === socket.id) {
            this.waitingPlayer = null;
            socket.emit("matchmaking:left");
            return;
        }

        const match = this.getMatch(socket);
        if (!match) return;

        const opponent = match.players.find(player => player.socket?.id !== socket.id)?.socket;
        this.deleteMatch(match);
        socket.emit("matchmaking:left");
        opponent?.emit("match-ended", { matchId: match.id, reason: "opponent-left" });
    }

    public disconnect(socket: AuthenticatedSocket): void
    {
        if (this.waitingPlayer?.id === socket.id) {
            this.waitingPlayer = null;
            return;
        }

        const match = this.getMatch(socket);
        if (!match) return;

        const player = match.players.find(candidate => candidate.socket?.id === socket.id);
        if (!player) return;

        // Keep the match and game alive. A page reload gets a new socket and
        // reattaches to this slot, then receives the full move stream.
        player.socket = null;
        this.matchIdsBySocketId.delete(socket.id);
    }

    public getMatch(socket: AuthenticatedSocket): Match | null
    {
        const matchId = this.matchIdsBySocketId.get(socket.id);
        return matchId ? this.matches.get(matchId) ?? null : null;
    }

    public getPlayerColor(match: Match, socket: AuthenticatedSocket): PlayerColor | null
    {
        return match.players.find(player => player.socket?.id === socket.id)?.color ?? null;
    }

    public getConnectedPlayers(match: Match): AuthenticatedSocket[]
    {
        return match.players.flatMap(player => player.socket ? [player.socket] : []);
    }

    public recordMove(match: Match, move: MoveQuery<Position>): void
    {
        match.moveHistory.push({
            from: { ...move.from },
            to: { ...move.to },
            ...(move.promoteTo ? { promoteTo: move.promoteTo } : {})
        });
    }

    private createMatch(first: AuthenticatedSocket, second: AuthenticatedSocket): void
    {
        const matchId = randomUUID();
        const game = new Game();
        game.setBoardLayout(DefaultBoard);
        const match: Match = {
            id: matchId,
            players: [
                { userId: first.data.user.id, displayName: first.data.user.displayName, color: "white", socket: null },
                { userId: second.data.user.id, displayName: second.data.user.displayName, color: "black", socket: null }
            ],
            game,
            moveHistory: []
        };

        this.matches.set(matchId, match);
        for (const player of match.players)
            this.matchIdsByUserId.set(player.userId, matchId);

        this.attachSocket(match, match.players[0], first);
        this.attachSocket(match, match.players[1], second);
        this.sendMatchSnapshot(match, match.players[0]);
        this.sendMatchSnapshot(match, match.players[1]);
    }

    private attachSocket(match: Match, player: MatchPlayer, socket: AuthenticatedSocket): void
    {
        if (player.socket && player.socket.id !== socket.id)
            this.matchIdsBySocketId.delete(player.socket.id);

        player.socket = socket;
        this.matchIdsBySocketId.set(socket.id, match.id);
        socket.data.matchId = match.id;
        socket.join(this.roomName(match.id));
    }

    private sendMatchSnapshot(match: Match, player: MatchPlayer): void
    {
        const opponent = match.players.find(candidate => candidate.userId !== player.userId);
        const socket = player.socket;
        if (!socket || !opponent) return;

        socket.emit("match-found", {
            matchId: match.id,
            color: player.color,
            opponent: { id: opponent.userId, displayName: opponent.displayName }
        });

        socket.emit("game-state", {
            matchId: match.id,
            board: DefaultBoard,
            turn: "white"
        });

        for (const move of match.moveHistory)
            socket.emit("move", move);
    }

    private deleteMatch(match: Match): void
    {
        this.matches.delete(match.id);
        for (const player of match.players) {
            this.matchIdsByUserId.delete(player.userId);
            if (player.socket) {
                this.matchIdsBySocketId.delete(player.socket.id);
                delete player.socket.data.matchId;
                player.socket.leave(this.roomName(match.id));
            }
        }
    }

    private roomName(matchId: string): string
    {
        return `match:${matchId}`;
    }
}

export { MatchmakingService };
export type { Match, MatchFoundPayload, PlayerColor };
