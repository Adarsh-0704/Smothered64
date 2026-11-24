import type { GameHistoryItem } from "../../lib/games";

function gameOutcome(
  game: GameHistoryItem,
): { label: string; className: string } {
  if (game.status === "cancelled" || game.result === null) {
    return { label: "Cancelled", className: "text-[#a9b0ae]" };
  }

  if (game.result === "draw") {
    return { label: "Draw", className: "text-[#c9a968]" };
  }

  const won =
    (game.color === "white" && game.result === "white_win") ||
    (game.color === "black" && game.result === "black_win");

  return won
    ? { label: "Won", className: "text-emerald-300" }
    : { label: "Lost", className: "text-red-300" };
}
function gameDate(value: string | null): string {
  if (!value) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function terminationLabel(value: string | null): string {
  if (!value) return "Game complete";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

interface GameHistoryListProps {
  games: GameHistoryItem[];
  emptyMessage?: string;
}

export default function GameHistoryList({
  games,
  emptyMessage = "No saved games yet. Finish a match between registered players to see it here.",
}: GameHistoryListProps) {
  if (games.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-black/10 px-5 py-8 text-center text-sm text-[#a9b0ae]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {games.map((game) => {
        const outcome = gameOutcome(game);

        return (
          <article
            key={game.id}
            className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/15 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`font-semibold ${outcome.className}`}>
                  {outcome.label}
                </span>
                <span className="text-sm text-[#c4cbc7]">
                  vs. {game.opponent.displayName}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-[#7f8b88]">
                  {game.color}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#7f8b88]">
                {gameDate(game.endedAt)} · {game.moveCount}{" "}
                {game.moveCount === 1 ? "move" : "moves"}
              </p>
            </div>
            <span className="text-xs text-[#a9b0ae] sm:text-right">
              {terminationLabel(game.terminationReason)}
            </span>
          </article>
        );
      })}
    </div>
  );
}
