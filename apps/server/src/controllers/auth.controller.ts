import type { Request, Response } from "express";
import { userStore } from "../db/user-store.js";
import {
    getBearerToken,
    getCookieToken,
} from "../middleware/auth.middleware.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { generateToken, verifyToken } from "../utils/jwt.js";
import { comparePassword, hashPassword } from "../utils/password.js";

const COOKIE_NAME = "smothered_token";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;


function getRequestBody(req: Request): Record<string, unknown> {
    const body: unknown = req.body;

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return {};
    }

    return body as Record<string, unknown>;
}

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" as const : "lax" as const,
    path: "/",
};

function setAuthCookie(res: Response, token: string): void {
    res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: COOKIE_MAX_AGE,
    });
}

export async function createGuest(
    req: Request,
    res: Response
): Promise<void> {
    const existingToken =
        getCookieToken(req.headers.cookie) ??
        getBearerToken(req.headers.authorization);

    if (existingToken) {
        let payload: ReturnType<typeof verifyToken> | null = null;

        try {
            payload = verifyToken(existingToken);
        } catch {
            // An expired or invalid token starts a new guest session.
        }

        if (payload) {
            try {
                const existingUser = await userStore.getById(payload.userId);

                if (existingUser?.kind === "guest") {
                    setAuthCookie(res, generateToken(existingUser));
                    res.status(200).json({ user: existingUser });
                    return;
                }
            } catch {
                res.status(503).json({
                    message: "Unable to retrieve the existing session",
                });
                return;
            }
        }
    }

    const user = userStore.createGuest();
    setAuthCookie(res, generateToken(user));

    res.status(201).json({ user });
}

export async function register(
    req: Request,
    res: Response
): Promise<void> {
    const { name, email, password } = getRequestBody(req);

    if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string" ||
        !name.trim() ||
        name.trim().length > 50 ||
        !email.trim() ||
        password.length < 8
    ) {
        res.status(400).json({
            message:
                "A name of 1–50 characters, email, and password of at least 8 characters are required",
        });
        return;
    }

    const cleanedEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(cleanedEmail)) {
        res.status(400).json({ message: "Invalid email address" });
        return;
    }

    try {
        const passwordHash = await hashPassword(password);

        const user = await userStore.createRegistered(
            name.trim(),
            cleanedEmail,
            passwordHash
        );

        setAuthCookie(res, generateToken(user));

        res.status(201).json({ user });
    } catch (error) {
        if (error instanceof Error && error.message === "User already exists") {
            res.status(409).json({ message: error.message });
            return;
        }

        res.status(500).json({ message: "Internal server error" });
    }
}

export async function login(
    req: Request,
    res: Response
): Promise<void> {
    const { email, password } = getRequestBody(req);

    if (typeof email !== "string" || typeof password !== "string") {
        res.status(400).json({
            message: "Email and password are required",
        });
        return;
    }

    try {
        const credentials = await userStore.getCredentialsByEmail(
            email.trim().toLowerCase()
        );

        if (
            !credentials ||
            !(await comparePassword(password, credentials.passwordHash))
        ) {
            res.status(401).json({
                message: "Invalid email or password",
            });
            return;
        }

        setAuthCookie(res, generateToken(credentials.user));

        res.status(200).json({ user: credentials.user });
    } catch {
        res.status(500).json({ message: "Internal server error" });
    }
}

export function me(req: AuthRequest, res: Response): void {
    res.status(200).json({ user: req.user });
}

export function logout(_req: Request, res: Response): void {
    res.clearCookie(COOKIE_NAME, cookieOptions);
    res.status(204).end();
}

export async function getProfile(
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
            message: "Guest accounts do not have profiles",
        });
        return;
    }

    try {
        const profile = await userStore.getProfileByUserId(user.id);

        if (!profile) {
            res.status(404).json({ message: "Profile not found" });
            return;
        }

        res.status(200).json({ profile });
    } catch {
        res.status(500).json({
            message: "Failed to retrieve profile",
        });
    }
}

export async function updateProfile(
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
            message: "Guest accounts cannot edit profiles",
        });
        return;
    }

    const { displayName, bio } = getRequestBody(req);

    if (
        displayName !== undefined &&
        (typeof displayName !== "string" ||
            !displayName.trim() ||
            displayName.trim().length > 50)
    ) {
        res.status(400).json({
            message: "Display name must contain 1–50 characters",
        });
        return;
    }

    if (
        bio !== undefined &&
        bio !== null &&
        (typeof bio !== "string" || bio.length > 160)
    ) {
        res.status(400).json({
            message: "Bio must contain at most 160 characters",
        });
        return;
    }

    try {
        const existingProfile = await userStore.getProfileByUserId(user.id);

        if (!existingProfile) {
            res.status(404).json({ message: "Profile not found" });
            return;
        }

        const profile = await userStore.updateProfile(
            user.id,
            typeof displayName === "string"
                ? displayName.trim()
                : existingProfile.displayName,
            bio === undefined
                ? existingProfile.bio
                : typeof bio === "string"
                    ? bio.trim()
                    : null
        );

        if (!profile) {
            res.status(404).json({ message: "Profile not found" });
            return;
        }

        res.status(200).json({ profile });
    } catch {
        res.status(500).json({
            message: "Failed to update profile",
        });
    }
}
