import type { Request, Response } from "express";
import { userStore } from "../db/user-store.js";
import { getBearerToken } from "../middleware/auth.middleware.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { generateToken, verifyToken } from "../utils/jwt.js";
import { comparePassword, hashPassword } from "../utils/password.js";

export async function createGuest(req: Request, res: Response): Promise<void>
{
    const existingToken = getBearerToken(req.headers.authorization);
    if (existingToken) {
        try {
            const payload = verifyToken(existingToken);
            const existingUser = userStore.getById(payload.userId);
            if (existingUser?.kind === "guest") {
                res.status(200).json({ token: generateToken(existingUser), user: existingUser });
                return;
            }
        }
        catch {
            // An expired or invalid token starts a new guest session.
        }
    }

    const user = userStore.createGuest();
    res.status(201).json({ token: generateToken(user), user });
}

export async function register(req: Request, res: Response): Promise<void>
{
    const { name, email, password } = req.body as Record<string, unknown>;
    if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string" ||
        !name.trim() || !email.trim() || password.length < 8) {
        res.status(400).json({ message: "Name, email, and a password of at least 8 characters are required" });
        return;
    }
    const cleanedEmail = email.trim().toLowerCase()
    if (!cleanedEmail.includes('@') || !cleanedEmail.includes('.')) {
        res.status(400).json({message: "Invalid email address"})
        return;
    }

    try {
        const user = userStore.createRegistered(name.trim(), cleanedEmail, await hashPassword(password));
        res.status(201).json({ token: generateToken(user), user });
    }
    catch (error) {
        if (error instanceof Error && error.message === "User already exists") {
            res.status(409).json({ message: error.message });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function login(req: Request, res: Response): Promise<void>
{
    const { email, password } = req.body as Record<string, unknown>;
    if (typeof email !== "string" || typeof password !== "string") {
        res.status(400).json({ message: "Email and password are required" });
        return;
    }
    const cleanedEmail = email.trim().toLowerCase()

    const credentials = userStore.getCredentialsByEmail(cleanedEmail);
    if (!credentials || !(await comparePassword(password, credentials.passwordHash))) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
    }

    res.status(200).json({ token: generateToken(credentials.user), user: credentials.user });
}

export function me(req: AuthRequest, res: Response): void
{
    res.status(200).json({ user: req.user });
}
