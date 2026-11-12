import jwt from "jsonwebtoken";
import type { AuthTokenPayload, PublicUser } from "../types/auth.js";

function getJwtSecret(): string
{
    const secret = process.env.JWT_SECRET;
    if (secret) return secret;

    if (process.env.NODE_ENV === "production")
        throw new Error("JWT_SECRET is required in production");

    return "smothered-development-secret-change-me";
}

export function generateToken(user: PublicUser): string
{
    return jwt.sign(
        { userId: user.id, userKind: user.kind },
        getJwtSecret(),
        { expiresIn: "7d" }
    );
}

export function verifyToken(token: string): AuthTokenPayload
{
    const decoded = jwt.verify(token, getJwtSecret());
    if (!decoded || typeof decoded !== "object")
        throw new Error("Invalid token payload");

    const payload = decoded as Partial<AuthTokenPayload>;
    if (typeof payload.userId !== 'string' || !payload.userId || (payload.userKind !== "guest" && payload.userKind !== "registered"))
        throw new Error("Invalid token payload");

    return {
        userId: payload.userId,
        userKind: payload.userKind,
        iat: payload.iat,
        exp: payload.exp
    };
}
