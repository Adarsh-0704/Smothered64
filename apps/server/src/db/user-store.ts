import { randomUUID } from "node:crypto";
import type { PublicUser } from "../types/auth.js";

interface StoredUser extends PublicUser {
    readonly email: string | null;
    readonly passwordHash: string | null;
}

class UserStore
{
    private readonly users = new Map<string, StoredUser>();
    private readonly userIdsByEmail = new Map<string, string>();

    public createGuest(): PublicUser
    {
        const user: StoredUser = {
            id: randomUUID(),
            displayName: `Guest-${randomUUID().slice(0, 6).toUpperCase()}`,
            kind: "guest",
            createdAt: new Date().toISOString(),
            email: null,
            passwordHash: null
        };

        this.users.set(user.id, user);
        return this.toPublicUser(user);
    }

    public createRegistered(displayName: string, email: string, passwordHash: string): PublicUser
    {
        const normalizedEmail = email.trim().toLowerCase();
        if (this.userIdsByEmail.has(normalizedEmail))
            throw new Error("User already exists");

        const user: StoredUser = {
            id: randomUUID(),
            displayName: displayName.trim(),
            kind: "registered",
            createdAt: new Date().toISOString(),
            email: normalizedEmail,
            passwordHash
        };

        this.users.set(user.id, user);
        this.userIdsByEmail.set(normalizedEmail, user.id);
        return this.toPublicUser(user);
    }

    public getById(id: string): PublicUser | null
    {
        const user = this.users.get(id);
        return user ? this.toPublicUser(user) : null;
    }

    public getCredentialsByEmail(email: string): { user: PublicUser; passwordHash: string } | null
    {
        const userId = this.userIdsByEmail.get(email.trim().toLowerCase());
        if (!userId) return null;

        const user = this.users.get(userId);
        if (!user?.passwordHash) return null;

        return {
            user: this.toPublicUser(user),
            passwordHash: user.passwordHash
        };
    }

    private toPublicUser(user: StoredUser): PublicUser
    {
        const { id, displayName, kind, createdAt } = user;
        return { id, displayName, kind, createdAt };
    }
}

const userStore = new UserStore();

export { UserStore, userStore };
