import { io } from "socket.io-client";
import type { ManagerOptions, Socket, SocketOptions } from "socket.io-client";
import {
    BOARD_SIZE,
    ChessRuleSet,
    DefaultBoard,
    Game,
    GameResult,
    GameStatus
} from "@smothered/chess_rule_engine";
import type {
    BoardStringLayout,
    GameBoardContext,
    MoveQuery,
    MoveRemark,
    Position
} from "@smothered/chess_rule_engine";
import type {
    CloseEvent,
    GameClientEvents,
    GameClientState,
    GameServerMessage,
    GameOverEvent,
    MatchEndedEvent,
    MatchFoundEvent
} from "./types/gameClient.js";

type SocketConnectionOptions = Partial<ManagerOptions & SocketOptions>;

type SocketLike = {
    connected: boolean;
    connect(): SocketLike;
    disconnect(): SocketLike;
    emit(event: string, ...args: any[]): SocketLike;
    on(event: string, listener: (...args: any[]) => void): SocketLike;
    off(event: string, listener: (...args: any[]) => void): SocketLike;
};

type SocketFactory = (url: string, options: SocketConnectionOptions) => SocketLike;

interface GameClientOptions {
    readonly socketOptions?: SocketConnectionOptions;
    readonly createSocket?: SocketFactory;
}

type Listener<K extends keyof GameClientEvents> = (payload: GameClientEvents[K]) => void;
type SocketEventHandler = (...args: any[]) => void;

const defaultSocketFactory: SocketFactory = (url, options) =>
    io(url, options) as unknown as Socket;

function isPosition(value: unknown): value is Position
{
    if (!value || typeof value !== "object") return false;

    const position = value as Record<string, unknown>;
    return Number.isInteger(position.x) && Number.isInteger(position.y);
}

function isMoveQuery(value: unknown): value is MoveQuery<Position>
{
    if (!value || typeof value !== "object") return false;

    const move = value as Record<string, unknown>;
    return isPosition(move.from) && isPosition(move.to) &&
        (move.promoteTo === undefined || typeof move.promoteTo === "string");
}

function isBoardLayout(value: unknown): value is BoardStringLayout
{
    return Array.isArray(value) && value.length === BOARD_SIZE &&
        value.every(row => Array.isArray(row) && row.length === BOARD_SIZE);
}

function isPieceColor(value: unknown): value is "white" | "black"
{
    return value === "white" || value === "black";
}

function isGameStatus(value: unknown): value is GameStatus
{
    return value === GameStatus.NOT_STARTED || value === GameStatus.ACTIVE ||
        value === GameStatus.WHITE_WON || value === GameStatus.BLACK_WON ||
        value === GameStatus.DRAW;
}

function isGameResult(value: unknown): value is GameResult
{
    return typeof value === "number" && Number.isInteger(value) &&
        value >= GameResult.PENDING &&
        value <= GameResult.DRAW_BY_INSUFFICIENT_MATERIAL;
}

function parseServerMessage(data: unknown): GameServerMessage
{
    const parsed = typeof data === "string" ? JSON.parse(data) : data;

    if (!parsed || typeof parsed !== "object")
        throw new Error("Server message must be an object");

    const message = parsed as Record<string, unknown>;

    if (message.type === "move") {
        const move = message.move ?? message;
        if (!isMoveQuery(move)) throw new Error("Server move event contains an invalid move");
        return { type: "move", move };
    }

    if (message.type === "state" || message.type === "game-state") {
        if (!isBoardLayout(message.board) || !isPieceColor(message.turn))
            throw new Error("Server state event contains an invalid board or turn");
        return {
            type: message.type,
            board: message.board,
            turn: message.turn,
            matchId: typeof message.matchId === "string" ? message.matchId : undefined
        };
    }

    if (message.type === "error" && typeof message.message === "string")
        return { type: "error", message: message.message };

    if (message.type === "game-over" && typeof message.matchId === "string" &&
        isGameStatus(message.status) && isGameResult(message.result)) {
        return {
            type: "game-over",
            matchId: message.matchId,
            status: message.status,
            result: message.result
        };
    }

    throw new Error("Unknown server message type");
}

function isMatchFoundEvent(value: unknown): value is MatchFoundEvent
{
    if (!value || typeof value !== "object") return false;
    const match = value as Record<string, unknown>;
    const opponent = match.opponent;
    return typeof match.matchId === "string" &&
        (match.color === "white" || match.color === "black") &&
        !!opponent && typeof opponent === "object" &&
        typeof (opponent as Record<string, unknown>).id === "string" &&
        typeof (opponent as Record<string, unknown>).displayName === "string";
}

function isMatchEndedEvent(value: unknown): value is MatchEndedEvent
{
    if (!value || typeof value !== "object") return false;
    const match = value as Record<string, unknown>;
    return typeof match.matchId === "string" && typeof match.reason === "string";
}

function isOpponentDisconnectedEvent(value: unknown): value is { matchId: string; reconnectDeadline: string }
{
    if (!value || typeof value !== "object") return false;
    const payload = value as Record<string, unknown>;
    return typeof payload.matchId === "string" &&
           typeof payload.reconnectDeadline === "string" &&
           !Number.isNaN(Date.parse(payload.reconnectDeadline));
}

function isOpponentReconnectedEvent(value: unknown): value is { matchId: string }
{
    return !!value && typeof value === "object" &&
        typeof (value as Record<string, unknown>).matchId === "string";
}

class GameClient
{
    private game: Game;
    private board: GameBoardContext;
    private serverOutcome: { status: GameStatus; result: GameResult } | null = null;
    private socket: SocketLike | null = null;
    private connectionPromise: Promise<void> | null = null;
    private removeSocketListeners: (() => void) | null = null;
    private selectedSq: number | null = null;
    private legalMoves: Position[] = [];
    private playerColor: "white" | "black" | null = null;
    private matchId: string | null = null;
    private readonly socketOptions: SocketConnectionOptions;
    private readonly createSocket: SocketFactory;
    private readonly listeners: {
        [K in keyof GameClientEvents]: Set<Listener<K>>
    } = {
        open: new Set(),
        close: new Set(),
        error: new Set(),
        message: new Set(),
        move: new Set(),
        matchmakingWaiting: new Set(),
        matchFound: new Set(),
        matchEnded: new Set(),
        gameOver: new Set(),
        opponentDisconnected: new Set(),
        opponentReconnected: new Set(),
        state: new Set()
    };

    public constructor(game?: Game, options: GameClientOptions = {})
    {
        this.game = game ?? new Game();
        if (!game) this.game.setBoardLayout(DefaultBoard);

        this.board = this.game.board.copyBoard();
        this.socketOptions = options.socketOptions ?? {};
        this.createSocket = options.createSocket ?? defaultSocketFactory;
    }

    public getGame(): Game { return this.game; }

    /** Return a copy so rendering code cannot mutate the client's game. */
    public getBoard(): GameBoardContext { return this.board.copyBoard(); }

    public getLastMove() { return this.game.lastMoveRecord; }
    public getGameStatus(): GameStatus { return this.serverOutcome?.status ?? this.game.currentStatus; }
    public getGameResult(): GameResult { return this.serverOutcome?.result ?? this.game.currentResult; }

    public getState(): GameClientState
    {
        return {
            board: this.getBoard(),
            turn: this.game.currentTurnColor,
            playerColor: this.playerColor,
            matchId: this.matchId,
            selectedSq: this.selectedSq,
            legalMoves: [...this.legalMoves],
            lastMove: this.game.lastMoveRecord,
            status: this.getGameStatus(),
            result: this.getGameResult()
        };
    }

    public selectSquare(position: Position | null): readonly Position[]
    {
        if (position === null) {
            this.selectedSq = null;
            this.legalMoves = [];
            this.emit("state", this.getState());
            return [];
        }

        const piece = this.game.board.getAtPos(position);
        if (!piece || piece.color !== this.game.currentTurnColor) {
            this.selectedSq = null;
            this.legalMoves = [];
        }
        else {
            this.selectedSq = position.y * this.game.board.boardSize + position.x;
            this.legalMoves = ChessRuleSet.getLegalMoves(this.game, position);
        }

        this.emit("state", this.getState());
        return [...this.legalMoves];
    }

    /** Apply a move to the local game. Server-originated moves use this method too. */
    public playMove(move: MoveQuery<Position>): MoveRemark
    {
        const remark = this.game.playMoveWithValidation(move);
        if (remark.executed) {
            this.refreshBoard();
            this.selectedSq = null;
            this.legalMoves = [];
            this.emit("move", { move, remark });
            this.emit("state", this.getState());
        }

        return remark;
    }

    /** Send a move request; local state changes after the server confirms it. */
    public requestMove(move: MoveQuery<Position>): void
    {
        this.send("move", move);
    }

    public resign(): void
    {
        this.send("game:resign");
    }

    public connect(url: string): Promise<void>
    {
        if (this.socket?.connected) return Promise.resolve();
        if (this.connectionPromise) return this.connectionPromise;

        const socket = this.createSocket(url, { autoConnect: false, ...this.socketOptions });
        this.socket = socket;

        this.connectionPromise = new Promise<void>((resolve, reject) => {
            let settled = false;

            const onConnect = () => {
                settled = true;
                this.connectionPromise = null;
                this.emit("open", undefined);
                if (this.matchId) socket.emit("matchmaking:join");
                resolve();
            };

            const onConnectError = (error: unknown) => {
                const connectionError = error instanceof Error
                    ? error
                    : new Error(String(error));
                this.emit("error", connectionError);

                if (!settled) {
                    settled = true;
                    this.connectionPromise = null;
                    reject(connectionError);
                }
            };

            const onDisconnect = (reason: unknown) => {
                if (this.socket === socket) this.socket = null;

                const close: CloseEvent = {
                    code: null,
                    reason: typeof reason === "string" ? reason : "Socket.IO disconnected",
                    wasClean: true
                };
                this.emit("close", close);

                if (!settled) {
                    settled = true;
                    this.connectionPromise = null;
                    reject(new Error(`Socket.IO disconnected before connecting: ${close.reason}`));
                }
            };

            const onMessage = (data: unknown) => this.handleMessage(data);
            const onMove = (data: unknown) => this.handleMessage({ type: "move", move: data });
            const onState = (data: unknown) => {
                const state = data && typeof data === "object" && "board" in data
                    ? data
                    : { board: data };
                this.handleMessage({ type: "state", ...state });
            };
            const onServerError = (message: unknown) => {
                const errorMessage = message && typeof message === "object" &&
                    "message" in message && typeof message.message === "string"
                    ? message.message
                    : typeof message === "string" ? message : String(message);
                this.emit("error", new Error(errorMessage));
            };
            const onMatchmakingWaiting = () => this.emit("matchmakingWaiting", undefined);
            const onMatchFound = (payload: unknown) => {
                if (isMatchFoundEvent(payload)) {
                    this.playerColor = payload.color;
                    this.matchId = payload.matchId;
                    this.emit("matchFound", payload);
                    this.emit("state", this.getState());
                }
                else this.emit("error", new Error("Server sent an invalid match-found event"));
            };
            const onMatchEnded = (payload: unknown) => {
                if (isMatchEndedEvent(payload)) {
                    this.playerColor = null;
                    this.matchId = null;
                    this.emit("matchEnded", payload);
                    this.emit("state", this.getState());
                }
                else this.emit("error", new Error("Server sent an invalid match-ended event"));
            };
            const onGameOver = (payload: unknown) => {
                const message = payload && typeof payload === "object"
                    ? { type: "game-over", ...payload }
                    : payload;
                this.handleMessage(message);
            };
            const onOpponentDisconnected = (payload: unknown) => {
                if (isOpponentDisconnectedEvent(payload))
                    this.emit("opponentDisconnected", payload);
                else this.emit("error", new Error("Server sent an invalid disconnect event"));
            };
            const onOpponentReconnected = (payload: unknown) => {
                if (isOpponentReconnectedEvent(payload))
                    this.emit("opponentReconnected", payload);
                else this.emit("error", new Error("Server sent an invalid reconnect event"));
            };

            this.addSocketListener(socket, "connect", onConnect);
            this.addSocketListener(socket, "connect_error", onConnectError);
            this.addSocketListener(socket, "disconnect", onDisconnect);
            this.addSocketListener(socket, "game-message", onMessage);
            this.addSocketListener(socket, "message", onMessage);
            this.addSocketListener(socket, "move", onMove);
            this.addSocketListener(socket, "state", onState);
            this.addSocketListener(socket, "game-state", onState);
            this.addSocketListener(socket, "game-error", onServerError);
            this.addSocketListener(socket, "matchmaking:waiting", onMatchmakingWaiting);
            this.addSocketListener(socket, "matchmaking:error", onServerError);
            this.addSocketListener(socket, "match-found", onMatchFound);
            this.addSocketListener(socket, "match-ended", onMatchEnded);
            this.addSocketListener(socket, "game-over", onGameOver);
            this.addSocketListener(socket, "opponent:disconnected", onOpponentDisconnected);
            this.addSocketListener(socket, "opponent:reconnected", onOpponentReconnected);

        });

        const connectionPromise = this.connectionPromise;
        socket.connect();
        return connectionPromise;
    }

    public disconnect(): void
    {
        const socket = this.socket;
        socket?.disconnect();
        this.removeSocketListeners?.();
        this.removeSocketListeners = null;
        this.socket = null;
        this.connectionPromise = null;
    }

    public isConnected(): boolean { return this.socket?.connected === true; }

    /** Emit a Socket.IO event with the supplied payload. */
    public send(event: string, ...args: unknown[]): void
    {
        if (!this.socket || !this.socket.connected)
            throw new Error("Cannot emit while the Socket.IO connection is not open");

        this.socket.emit(event, ...args);
    }

    public handleMessage(data: unknown): void
    {
        let message: GameServerMessage;
        try {
            message = parseServerMessage(data);
        }
        catch (error) {
            this.emit("error", error instanceof Error ? error : new Error(String(error)));
            return;
        }

        this.emit("message", message);

        if (message.type === "move") {
            const remark = this.playMove(message.move);
            if (!remark.executed)
                this.emit("error", new Error(`Server sent an invalid move: ${remark.result}`));
            else this.serverOutcome = null;
        }
        else if (message.type === "state" || message.type === "game-state") {
            const nextGame = new Game();
            if (!nextGame.setBoardLayout(message.board)) {
                this.emit("error", new Error("Server sent an invalid board state"));
                return;
            }

            if (message.turn === "black")
                nextGame.applyChanges({ moves: [], captures: [], promotions: [] });

            this.game = nextGame;
            this.serverOutcome = null;
            if (message.matchId) this.matchId = message.matchId;
            this.refreshBoard();
            this.selectedSq = null;
            this.legalMoves = [];
            this.emit("state", this.getState());
        }
        else if (message.type === "error") {
            this.emit("error", new Error(message.message));
        }
        else if (message.type === "game-over") {
            if (this.matchId && message.matchId !== this.matchId) return;

            this.serverOutcome = { status: message.status, result: message.result };
            this.matchId = null;
            this.selectedSq = null;
            this.legalMoves = [];
            const gameOver: GameOverEvent = {
                matchId: message.matchId,
                status: message.status,
                result: message.result
            };
            this.emit("gameOver", gameOver);
            this.emit("state", this.getState());
        }
    }

    public on<K extends keyof GameClientEvents>(event: K, listener: Listener<K>): () => void
    {
        const listeners = this.listeners[event] as Set<Listener<K>>;
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    private addSocketListener(socket: SocketLike, event: string, listener: SocketEventHandler): void
    {
        socket.on(event, listener);
        const previousRemove = this.removeSocketListeners;
        this.removeSocketListeners = () => {
            previousRemove?.();
            socket.off(event, listener);
        };
    }

    private refreshBoard(): void
    {
        this.board = this.game.board.copyBoard();
    }

    private emit<K extends keyof GameClientEvents>(event: K, payload: GameClientEvents[K]): void
    {
        for (const listener of this.listeners[event] as Set<Listener<K>>)
            listener(payload);
    }
}

export { GameClient };
export type {
    GameClientOptions,
    SocketConnectionOptions,
    SocketFactory,
    SocketLike
};
