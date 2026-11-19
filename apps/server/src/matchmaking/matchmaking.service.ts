import { randomUUID } from "node:crypto";
import { DefaultBoard, Game, GameResult, GameStatus } from "@smothered/chess_rule_engine";
import type { MoveQuery, Position } from "@smothered/chess_rule_engine";
import { getPrisma } from "../db/prisma.js";
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
    readonly isRegistered: boolean;
    readonly color: PlayerColor;
    socket: AuthenticatedSocket | null;
}

interface Match {
    readonly id: string;
    readonly players: [MatchPlayer, MatchPlayer];
    readonly game: Game;
    readonly moveHistory: MoveQuery<Position>[];
    reconnectTimer: NodeJS.Timeout | null;
    reconnectDeadline: number | null;
    readonly createdAt: Date;
}

class MatchmakingService
{
    private waitingPlayer: AuthenticatedSocket | null = null;
    private readonly matches = new Map<string, Match>();
    private readonly matchIdsBySocketId = new Map<string, string>();
    private readonly matchIdsByUserId = new Map<string, string>();
    private readonly reconnectGracePeriodMs: number;

    public constructor(reconnectGracePeriodSeconds = Number(process.env.RECONNECT_GRACE_SECONDS ?? 60))
    {
        const seconds = Number.isFinite(reconnectGracePeriodSeconds) && reconnectGracePeriodSeconds > 0
            ? reconnectGracePeriodSeconds
            : 60;
        this.reconnectGracePeriodMs = Math.floor(seconds * 1000);
    }

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

                const wasDisconnected = player.socket === null;
                this.attachSocket(existingMatch, player, socket);
                if (wasDisconnected) {
                    const opponent = existingMatch.players.find(candidate => candidate.userId !== player.userId);
                    opponent?.socket?.emit("opponent:reconnected", { matchId: existingMatch.id });
                }
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
        delete socket.data.matchId;

        match.reconnectDeadline = Date.now() + this.reconnectGracePeriodMs;
        match.reconnectTimer = setTimeout(() => {
            this.abandonMatch(match, player.userId);
        }, this.reconnectGracePeriodMs);
        match.reconnectTimer.unref?.();

        for (const opponent of match.players) {
            if (opponent.userId !== player.userId) {
                opponent.socket?.emit("opponent:disconnected", {
                    matchId: match.id,
                    reconnectDeadline: new Date(match.reconnectDeadline).toISOString(),
                });
            }
        }
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

    public async complete(match: Match): Promise<void>
    {
        await this.finishMatch(match, match.game.currentStatus, match.game.currentResult);
    }

    public async resign(match: Match, resigningColor: PlayerColor): Promise<void>
    {
        const winner = resigningColor === "white" ? "black" : "white";
        await this.finishMatch(
            match,
            winner === "white" ? GameStatus.WHITE_WON : GameStatus.BLACK_WON,
            GameResult.RESIGN,
        );
    }

    private createMatch(first: AuthenticatedSocket, second: AuthenticatedSocket): void
    {
        const matchId = randomUUID();
        const game = new Game();
        game.setBoardLayout(DefaultBoard);
        const match: Match = {
            id: matchId,
            players: [
                { userId: first.data.user.id, displayName: first.data.user.displayName, isRegistered: first.data.user.kind === "registered", color: "white", socket: null },
                { userId: second.data.user.id, displayName: second.data.user.displayName, isRegistered: second.data.user.kind === "registered", color: "black", socket: null }
            ],
            game,
            moveHistory: [],
            reconnectTimer: null,
            reconnectDeadline: null,
            createdAt: new Date()
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
        this.clearReconnectTimer(match);
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
        this.clearReconnectTimer(match);
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

    private abandonMatch(match: Match, disconnectedUserId: string): void
    {
        if (this.matches.get(match.id) !== match) return;

        const disconnectedPlayer = match.players.find(player => player.userId === disconnectedUserId);
        if (!disconnectedPlayer || disconnectedPlayer.socket) return;

        const winner = match.players.find(player => player.userId !== disconnectedUserId);
        if (!winner) return;

        void this.finishMatch(
            match,
            winner.color === "white" ? GameStatus.WHITE_WON : GameStatus.BLACK_WON,
            GameResult.ABANDONED,
        );
    }

    private clearReconnectTimer(match: Match): void
    {
        if (match.reconnectTimer) clearTimeout(match.reconnectTimer);
        match.reconnectTimer = null;
        match.reconnectDeadline = null;
    }

    private async finishMatch(
        match: Match,
        status: GameStatus,
        result: GameResult,
    ): Promise<void>
    {
        if (this.matches.get(match.id) !== match) return;

        const gameOver = { matchId: match.id, status, result } as const;
        for (const player of this.getConnectedPlayers(match))
            player.emit("game-over", gameOver);

        // Remove the live match before awaiting database I/O so no further move
        // can create a duplicate game record.
        this.deleteMatch(match);
        await this.persistCompletedGame(match, status, result);
    }

    private async persistCompletedGame(
        match: Match,
        status: GameStatus,
        result: GameResult,
    ): Promise<void>
    {
        // Guest identities only exist in memory and cannot satisfy the games
        // table's user foreign keys, so only registered-vs-registered games
        // are persisted.
        if (match.players.some(player => !player.isRegistered)) return;

        const [whitePlayer, blackPlayer] = match.players;
        const gameResult = status === GameStatus.WHITE_WON
            ? "white_win"
            : status === GameStatus.BLACK_WON
                ? "black_win"
                : "draw";
        const terminationReason = GameResult[result].toLowerCase();

        try {
            await getPrisma().game.create({
                data: {
                    id: match.id,
                    gameType: "casual",
                    gameMode: "human",
                    gameStatus: result === GameResult.ABANDONED ? "abandoned" : "completed",
                    visibility: "public",
                    timeControlCategory: "unlimited",
                    whitePlayerId: whitePlayer.userId,
                    blackPlayerId: blackPlayer.userId,
                    initialTimeSeconds: 0,
                    incrementSeconds: 0,
                    result: gameResult,
                    terminationReason,
                    createdAt: match.createdAt,
                    startedAt: match.createdAt,
                    endedAt: new Date(),
                    moves: {
                        create: match.moveHistory.map((move, index) => ({
                            moveNumber: index + 1,
                            uci: this.toUci(move),
                        })),
                    },
                },
            });
        } catch (error) {
            console.error("Failed to persist completed game", error);
        }
    }

    private toUci(move: MoveQuery<Position>): string
    {
        const file = (x: number) => String.fromCharCode("a".charCodeAt(0) + x);
        const from = `${file(move.from.x)}${8 - move.from.y}`;
        const to = `${file(move.to.x)}${8 - move.to.y}`;
        return `${from}${to}${move.promoteTo?.toLowerCase() ?? ""}`;
    }
}

export { MatchmakingService };
export type { Match, MatchFoundPayload, PlayerColor };
