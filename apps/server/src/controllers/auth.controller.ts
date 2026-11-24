import type { Request, Response } from "express";
import { userStore } from "../db/user-store.js";
import {
    getBearerToken,
    getCookieToken,
} from "../middleware/auth.middleware.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { generateToken, verifyToken } from "../utils/jwt.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { clearAuthCookie, setAuthCookie } from "../utils/auth-cookie.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;


function getRequestBody(req: Request): Record<string, unknown> {
    const body: unknown = req.body;

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return {};
    }

    return body as Record<string, unknown>;
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
                if (payload.userKind !== "guest") {
                    res.status(503).json({
                        message: "Unable to retrieve the existing session",
                    });
                    return;
                }

                // Guest users are kept in memory, so a server restart can
                // leave a valid JWT pointing to a guest that no longer exists.
                // Treat that stale guest session like any other invalid guest
                // token and create a replacement below.
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
        name.trim().length > 30 ||
        !email.trim() ||
        password.length < 8
    ) {
        res.status(400).json({
            message:
                "A username of 1–30 characters, email, and password of at least 8 characters are required",
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
    clearAuthCookie(res);
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

    const { username, avatarUrl, bio, country, dateOfBirth } = getRequestBody(req);

    if (
        username !== undefined &&
        (typeof username !== "string" ||
            !username.trim() ||
            username.trim().length > 30)
    ) {
        res.status(400).json({
            message: "Username must contain 1–30 characters",
        });
        return;
    }

    if (avatarUrl !== undefined && avatarUrl !== null && typeof avatarUrl !== "string") {
        res.status(400).json({ message: "Avatar URL must be text or null" });
        return;
    }

    if (country !== undefined && country !== null && typeof country !== "string") {
        res.status(400).json({ message: "Country must be text or null" });
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

    if (
        dateOfBirth !== undefined &&
        dateOfBirth !== null &&
        (typeof dateOfBirth !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
            Number.isNaN(Date.parse(`${dateOfBirth}T00:00:00.000Z`)) ||
            new Date(`${dateOfBirth}T00:00:00.000Z`).toISOString().slice(0, 10) !== dateOfBirth)
    ) {
        res.status(400).json({ message: "Date of birth must use YYYY-MM-DD" });
        return;
    }

    try {
        const existingProfile = await userStore.getProfileByUserId(user.id);

        if (!existingProfile) {
            res.status(404).json({ message: "Profile not found" });
            return;
        }

        const profile = await userStore.updateProfile(user.id, {
            ...(typeof username === "string" ? { username: username.trim() } : {}),
            ...(avatarUrl !== undefined
                ? { avatarUrl: typeof avatarUrl === "string" ? avatarUrl.trim() || null : null }
                : {}),
            ...(bio !== undefined
                ? { bio: typeof bio === "string" ? bio.trim() || null : null }
                : {}),
            ...(country !== undefined
                ? { country: typeof country === "string" ? country.trim() || null : null }
                : {}),
            ...(dateOfBirth !== undefined
                ? { dateOfBirth: typeof dateOfBirth === "string" ? dateOfBirth : null }
                : {}),
        });

        if (!profile) {
            res.status(404).json({ message: "Profile not found" });
            return;
        }

        res.status(200).json({ profile });
    } catch (error) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2002"
        ) {
            res.status(409).json({ message: "Username is already taken" });
            return;
        }

        res.status(500).json({
            message: "Failed to update profile",
        });
    }
}
