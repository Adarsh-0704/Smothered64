import type {
    GameBoardContext,
    GameResult,
    GameStatus,
    MoveQuery,
    MoveRecord,
    PieceColor,
    Position,
    BoardStringLayout,
    MoveRemark
} from "@smothered/chess_rule_engine";

interface GameClientState {
    readonly board: GameBoardContext;
    readonly turn: PieceColor;
    readonly playerColor: PieceColor | null;
    readonly matchId: string | null;
    readonly selectedSq: number | null;
    readonly legalMoves: readonly Position[];
    readonly lastMove: Readonly<MoveRecord> | null;
    readonly status: GameStatus;
    readonly result: GameResult;
}

interface MoveMessage {
    readonly type: "move";
    readonly move: MoveQuery<Position>;
}

interface StateMessage {
    readonly type: "state" | "game-state";
    readonly board: BoardStringLayout;
    readonly turn: PieceColor;
    readonly matchId?: string;
}

interface ErrorMessage {
    readonly type: "error";
    readonly message: string;
}

type GameServerMessage = MoveMessage | StateMessage | ErrorMessage;

interface MoveEvent {
    readonly move: MoveQuery<Position>;
    readonly remark: MoveRemark;
}

interface MatchFoundEvent {
    readonly matchId: string;
    readonly color: PieceColor;
    readonly opponent: {
        readonly id: string;
        readonly displayName: string;
    };
}

interface MatchEndedEvent {
    readonly matchId: string;
    readonly reason: string;
}

interface CloseEvent {
    readonly code: number | null;
    readonly reason: string;
    readonly wasClean: boolean;
}

interface GameClientEvents {
    readonly open: undefined;
    readonly close: CloseEvent;
    readonly error: Error;
    readonly message: GameServerMessage;
    readonly move: MoveEvent;
    readonly matchmakingWaiting: undefined;
    readonly matchFound: MatchFoundEvent;
    readonly matchEnded: MatchEndedEvent;
    readonly state: GameClientState;
}

export type {
    CloseEvent,
    ErrorMessage,
    GameClientEvents,
    GameClientState,
    GameServerMessage,
    MatchEndedEvent,
    MatchFoundEvent,
    MoveEvent,
    MoveMessage,
    StateMessage
};
