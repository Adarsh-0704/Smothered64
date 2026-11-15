import type { NextFunction, Request, Response } from "express";
import { userStore } from "../db/user-store.js";
import { verifyToken } from "../utils/jwt.js";
import type { PublicUser } from "../types/auth.js";

interface AuthRequest extends Request {
    user?: PublicUser;
}

function getBearerToken(authorization: string | undefined): string | null {
    if (!authorization?.startsWith("Bearer ")) return null;

    const token = authorization.slice("Bearer ".length).trim();
    return token || null;
}

function getCookieToken(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) return null;

    const cookie = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("smothered_token="));

    if (!cookie) return null;

    try {
        const token = decodeURIComponent(
            cookie.slice("smothered_token=".length)
        );
        return token || null;
    } catch {
        return null;
    }
}

async function authenticate(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    const token =
        getCookieToken(req.headers.cookie) ??
        getBearerToken(req.headers.authorization);

    if (!token) {
        res.status(401).json({ message: "Unauthorized: token missing" });
        return;
    }

    let payload;

    try {
        payload = verifyToken(token);
    } catch {
        res.status(401).json({
            message: "Unauthorized: invalid or expired token",
        });
        return;
    }

    try {
        const user = await userStore.getById(payload.userId);

        if (!user) {
            res.status(401).json({
                message: "Unauthorized: user not found",
            });
            return;
        }

        req.user = user;
        next();
    } catch {
        res.status(500).json({
            message: "Failed to authenticate user",
        });
    }
}

export { authenticate, getBearerToken, getCookieToken };
export type { AuthRequest };