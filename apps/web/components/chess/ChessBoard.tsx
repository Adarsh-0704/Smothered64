"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameClient, GameClientState } from "@smothered/client";
import type {
  PieceLayoutCode,
  PieceName,
  PieceNameCode,
  Position,
} from "@smothered/chess_rule_engine";
import Piece from "./Piece";

type BoardOrientation = "white" | "black";

interface ChessBoardProps {
  readonly gameClient: GameClient;
  readonly orientation?: BoardOrientation;
  readonly className?: string;
}

interface PromotionMove {
  readonly from: Position;
  readonly to: Position;
}

const promotionChoices: readonly { code: PieceNameCode; label: string }[] = [
  { code: "Q", label: "Queen" },
  { code: "R", label: "Rook" },
  { code: "B", label: "Bishop" },
  { code: "N", label: "Knight" },
];

const pieceCodes: Record<PieceName, PieceLayoutCode> = {
  pawn: "wP",
  knight: "wN",
  bishop: "wB",
  rook: "wR",
  queen: "wQ",
  king: "wK",
};

function positionToIndex(position: Position): number {
  return position.y * 8 + position.x;
}

function displayPosition(index: number, orientation: BoardOrientation): Position {
  const displayX = index % 8;
  const displayY = Math.floor(index / 8);

  return orientation === "white"
    ? { x: displayX, y: displayY }
    : { x: 7 - displayX, y: 7 - displayY };
}

function squareName(position: Position): string {
  return `${String.fromCharCode(97 + position.x)}${8 - position.y}`;
}

function pieceCode(piece: {
  readonly color: "white" | "black";
  readonly name: PieceName;
}): PieceLayoutCode {
  const code = pieceCodes[piece.name];
  return `${piece.color === "white" ? "w" : "b"}${code[1]}` as PieceLayoutCode;
}

function getLastMoveSquares(state: GameClientState): Set<number> {
  const squares = new Set<number>();
  const lastMove = state.lastMove;

  if (!lastMove) return squares;

  for (const move of lastMove.moves) {
    squares.add(positionToIndex(move.from));
    squares.add(positionToIndex(move.to));
  }
  for (const capture of lastMove.captures) squares.add(positionToIndex(capture.from));
  for (const promotion of lastMove.promotions) squares.add(positionToIndex(promotion.to));

  return squares;
}

export default function ChessBoard({
  gameClient,
  orientation = "white",
  className = "",
}: ChessBoardProps) {
  const [state, setState] = useState<GameClientState>(() => gameClient.getState());
  const [error, setError] = useState<string | null>(null);
  const [promotionMove, setPromotionMove] = useState<PromotionMove | null>(null);

  useEffect(() => {
    const removeStateListener = gameClient.on("state", (nextState) => {
      setState(nextState);
      setPromotionMove(null);
    });
    const removeErrorListener = gameClient.on("error", (nextError) => {
      setError(nextError.message);
    });

    return () => {
      removeStateListener();
      removeErrorListener();
    };
  }, [gameClient]);

  const lastMoveSquares = useMemo(() => getLastMoveSquares(state), [state]);
  const legalMoveSquares = useMemo(
    () => new Set(state.legalMoves.map(positionToIndex)),
    [state.legalMoves],
  );

  function handleSquareClick(position: Position) {
    setError(null);
    const index = positionToIndex(position);

    if (state.selectedSq !== null && legalMoveSquares.has(index)) {
      const from = {
        x: state.selectedSq % 8,
        y: Math.floor(state.selectedSq / 8),
      };

      const movingPiece = state.board.getAtPos(from);
      if (movingPiece?.name === "pawn" && (position.y === 0 || position.y === 7)) {
        setPromotionMove({ from, to: position });
        return;
      }

      try {
        gameClient.requestMove({ from, to: position });
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : String(requestError));
      }
      return;
    }

    const piece = state.board.getAtPos(position);
    if (piece?.color === state.turn &&
      (state.playerColor === null || piece.color === state.playerColor)) {
      gameClient.selectSquare(position);
    }
    else gameClient.selectSquare(null);
  }

  return (
    <div className={className}>
      <div
        className="relative aspect-square w-[min(88vw,720px)] overflow-hidden rounded-[6px] border-[10px] border-[#d1b17a] bg-[#829d5c] bg-[url('/chess/boards/classic.png')] bg-cover bg-center bg-no-repeat shadow-[0_25px_55px_rgb(0_0_0_/_0.38),0_3px_0_rgb(255_255_255_/_0.09)_inset,0_-4px_0_rgb(0_0_0_/_0.18)_inset]"
        role="grid"
        aria-label="Chess board"
      >
        <div className="grid h-full w-full grid-cols-8 grid-rows-8">
          {Array.from({ length: 64 }, (_, index) => {
            const position = displayPosition(index, orientation);
            const boardIndex = positionToIndex(position);
            const piece = state.board.getAtPos(position);
            const isSelected = state.selectedSq === boardIndex;
            const isLegalMove = legalMoveSquares.has(boardIndex);
            const isLastMove = lastMoveSquares.has(boardIndex);
            const isCapture = isLegalMove && piece !== null;
            const classes = [
              "relative min-h-0 min-w-0 cursor-pointer select-none border-0 bg-transparent p-0 hover:bg-white/10 focus-visible:z-[3] focus-visible:outline-[3px] focus-visible:outline-[#f5d46e] focus-visible:outline-offset-[-3px]",
              isSelected && isLastMove ? "bg-[rgb(255_207_51_/_0.58)]" : "",
              isSelected && !isLastMove ? "bg-[rgb(255_207_51_/_0.46)]" : "",
              isLastMove && !isSelected ? "bg-[rgb(229_185_62_/_0.42)]" : "",
            ].filter(Boolean).join(" ");

            return (
              <button
                key={boardIndex}
                type="button"
                role="gridcell"
                className={classes}
                aria-label={`${squareName(position)}${piece ? `, ${piece.color} ${piece.name}` : ""}`}
                onClick={() => handleSquareClick(position)}
              >
                {isLegalMove && (
                  <span
                    className={isCapture
                      ? "pointer-events-none absolute left-1/2 top-1/2 z-[2] h-[84%] w-[84%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[max(3px,0.35vw)] border-[rgb(25_25_25_/_0.36)]"
                      : "pointer-events-none absolute left-1/2 top-1/2 z-[2] aspect-square w-1/4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(25_25_25_/_0.35)]"}
                  />
                )}
                {piece && (
                  <Piece
                    code={pieceCode(piece)}
                    name={`${piece.color} ${piece.name}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
      {promotionMove && (
        <div
          className="fixed inset-0 z-10 grid place-items-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="promotion-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#20272a] p-5 text-[#efe9d0] shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#c9a968]">
                  Promotion
                </p>
                <h2 id="promotion-title" className="mt-1 text-xl font-semibold">
                  Choose a piece
                </h2>
              </div>
              <button
                type="button"
                className="rounded-full px-2 py-1 text-xl leading-none text-[#a9b0ae] hover:bg-white/10 hover:text-white"
                aria-label="Cancel promotion"
                onClick={() => setPromotionMove(null)}
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {promotionChoices.map((choice) => {
                const color = state.board.getAtPos(promotionMove.from)?.color ?? state.turn;
                const code = `${color === "white" ? "w" : "b"}${choice.code}` as PieceLayoutCode;

                return (
                  <button
                    key={choice.code}
                    type="button"
                    className="group flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2 transition hover:border-[#c9a968] hover:bg-[#c9a968]/15 focus-visible:outline-2 focus-visible:outline-[#f5d46e]"
                    aria-label={`Promote to ${choice.label}`}
                    onClick={() => {
                      try {
                        gameClient.requestMove({
                          from: promotionMove.from,
                          to: promotionMove.to,
                          promoteTo: choice.code,
                        });
                        setPromotionMove(null);
                      } catch (requestError) {
                        setError(requestError instanceof Error ? requestError.message : String(requestError));
                      }
                    }}
                  >
                    <span className="relative block h-16 w-16">
                      <Piece code={code} name={`${color} ${choice.label.toLowerCase()}`} />
                    </span>
                    <span className="text-xs text-[#c4cbc7] group-hover:text-white">{choice.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {error && <p role="status">{error}</p>}
    </div>
  );
}

export type { ChessBoardProps, BoardOrientation };
