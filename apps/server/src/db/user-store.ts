import { randomUUID } from "node:crypto";
import { getPrisma } from "./prisma.js";
import type { PublicProfile, PublicUser } from "../types/auth.js";

interface StoredGuest extends PublicUser {
    readonly kind: "guest";
}

class UserStore {
    private readonly guests = new Map<string, StoredGuest>();

    public createGuest(): PublicUser {
        const user: StoredGuest = {
            id: randomUUID(),
            displayName: `Guest-${randomUUID().slice(0, 6).toUpperCase()}`,
            kind: "guest",
            createdAt: new Date().toISOString(),
        };

        this.guests.set(user.id, user);
        return user;
    }

    public async createRegistered(
        username: string,
        email: string,
        passwordHash: string
    ): Promise<PublicUser> {
        const normalizedEmail = email.trim().toLowerCase();

        try {
            const user = await getPrisma().user.create({
                data: {
                    username: username.trim(),
                    email: normalizedEmail,
                    passwordHash,
                    profile: {
                        create: {},
                    },
                },
                include: {
                    profile: true,
                },
            });

            if (!user.profile) {
                throw new Error("Profile creation failed");
            }

            return {
                id: user.id,
                displayName: user.username,
                kind: "registered",
                createdAt: user.createdAt.toISOString(),
            };
        } catch (error) {
            if (
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                error.code === "P2002"
            ) {
                throw new Error("User already exists");
            }

            throw error;
        }
    }

    public async getById(id: string): Promise<PublicUser | null> {
        const guest = this.guests.get(id);

        if (guest) {
            return guest;
        }

        const user = await getPrisma().user.findUnique({
            where: { id },
            include: { profile: true },
        });

        if (!user || !user.profile || user.accountStatus !== "active") {
            return null;
        }

        return {
            id: user.id,
            displayName: user.username,
            kind: "registered",
            createdAt: user.createdAt.toISOString(),
        };
    }

    public async getCredentialsByEmail(
        email: string
    ): Promise<{ user: PublicUser; passwordHash: string } | null> {
        const user = await getPrisma().user.findUnique({
            where: {
                email: email.trim().toLowerCase(),
            },
            include: {
                profile: true,
            },
        });

        if (!user || !user.profile || user.accountStatus !== "active") {
            return null;
        }

        return {
            user: {
                id: user.id,
                displayName: user.username,
                kind: "registered",
                createdAt: user.createdAt.toISOString(),
            },
            passwordHash: user.passwordHash,
        };
    }

    public async getProfileByUserId(
        userId: string
    ): Promise<PublicProfile | null> {
        const user = await getPrisma().user.findUnique({
            where: { id: userId },
            include: { profile: true },
        });

        if (!user || !user.profile || user.accountStatus !== "active") {
            return null;
        }

        return {
            userId: user.id,
            email: user.email,
            username: user.username,
            avatarUrl: user.profile.avatarUrl,
            bio: user.profile.bio,
            country: user.profile.country,
            dateOfBirth: user.profile.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        };
    }

    public async updateProfile(
        userId: string,
        updates: {
            readonly username?: string;
            readonly avatarUrl?: string | null;
            readonly bio?: string | null;
            readonly country?: string | null;
            readonly dateOfBirth?: string | null;
        }
    ): Promise<PublicProfile | null> {
        const existingProfile = await getPrisma().userProfile.findUnique({
            where: { userId },
        });

        if (!existingProfile) {
            return null;
        }

        await getPrisma().$transaction(async (transaction) => {
            if (updates.username !== undefined) {
                await transaction.user.update({
                    where: { id: userId },
                    data: { username: updates.username.trim() },
                });
            }

            await transaction.userProfile.update({
                where: { userId },
                data: {
                    ...(updates.avatarUrl !== undefined ? { avatarUrl: updates.avatarUrl } : {}),
                    ...(updates.bio !== undefined ? { bio: updates.bio } : {}),
                    ...(updates.country !== undefined ? { country: updates.country } : {}),
                    ...(updates.dateOfBirth !== undefined
                        ? { dateOfBirth: updates.dateOfBirth ? new Date(`${updates.dateOfBirth}T00:00:00.000Z`) : null }
                        : {}),
                },
            });
        });

        return this.getProfileByUserId(userId);
    }
}

const userStore = new UserStore();

export { UserStore, userStore };
