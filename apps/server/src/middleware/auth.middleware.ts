import type { NextFunction, Request, Response } from "express";
import { userStore } from "../db/user-store.js";
import { verifyToken } from "../utils/jwt.js";
import type { PublicUser } from "../types/auth.js";

interface AuthRequest extends Request {
    user?: PublicUser;
}

function getBearerToken(authorization: string | undefined): string | null
{
    if (!authorization?.startsWith("Bearer ")) return null;
    const token = authorization.slice("Bearer ".length).trim();
    return token || null;
}

function authenticate(req: AuthRequest, res: Response, next: NextFunction): void
{
    try {
        const token = getBearerToken(req.headers.authorization);
        if (!token) {
            res.status(401).json({ message: "Unauthorized: token missing" });
            return;
        }

        const payload = verifyToken(token);
        const user = userStore.getById(payload.userId);
        if (!user) {
            res.status(401).json({ message: "Unauthorized: user not found" });
            return;
        }

        req.user = user;
        next();
    }
    catch {
        res.status(401).json({ message: "Unauthorized: invalid or expired token" });
    }
}

export { authenticate, getBearerToken };
export type { AuthRequest };
