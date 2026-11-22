import type { Response } from "express";
import { getPrisma } from "../db/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const DEFAULT_GAME_LIMIT = 50;
const MAX_GAME_LIMIT = 100;

function getGameLimit(value: unknown): number {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
        return DEFAULT_GAME_LIMIT;
    }

    return Math.min(parsed, MAX_GAME_LIMIT);
}

export async function getGameHistory(
    req: AuthRequest,
    res: Response
): Promise<void> {
    const user = req.user;

    if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    if (user.kind !== "registered") {
        res.status(403).json({
            message: "Guest accounts do not have game history",
        });
        return;
    }

    try {
        const games = await getPrisma().game.findMany({
            where: {
                OR: [
                    { whitePlayerId: user.id },
                    { blackPlayerId: user.id },
                ],
            },
            orderBy: [
                { endedAt: "desc" },
                { createdAt: "desc" },
            ],
            take: getGameLimit(req.query.limit),
            include: {
                whitePlayer: {
                    select: { id: true, username: true },
                },
                blackPlayer: {
                    select: { id: true, username: true },
                },
                _count: {
                    select: { moves: true },
                },
            },
        });

        res.status(200).json({
            games: games.map((game) => {
                const isWhite = game.whitePlayerId === user.id;
                const opponent = isWhite ? game.blackPlayer : game.whitePlayer;

                return {
                    id: game.id,
                    opponent: {
                        id: opponent.id,
                        displayName: opponent.username,
                    },
                    color: isWhite ? "white" : "black",
                    result: game.result,
                    status: game.gameStatus,
                    terminationReason: game.terminationReason,
                    moveCount: game._count.moves,
                    createdAt: game.createdAt.toISOString(),
                    startedAt: game.startedAt?.toISOString() ?? null,
                    endedAt: game.endedAt?.toISOString() ?? null,
                };
            }),
        });
    } catch {
        res.status(500).json({
            message: "Failed to retrieve game history",
        });
    }
}
