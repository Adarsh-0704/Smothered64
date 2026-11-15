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
        displayName: string,
        email: string,
        passwordHash: string
    ): Promise<PublicUser> {
        const normalizedEmail = email.trim().toLowerCase();

        try {
            const user = await getPrisma().user.create({
                data: {
                    email: normalizedEmail,
                    passwordHash,
                    kind: "REGISTERED",
                    profile: {
                        create: {
                            displayName: displayName.trim(),
                        },
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
                displayName: user.profile.displayName,
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

        if (!user || !user.profile) {
            return null;
        }

        return {
            id: user.id,
            displayName: user.profile.displayName,
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

        if (!user || !user.profile) {
            return null;
        }

        return {
            user: {
                id: user.id,
                displayName: user.profile.displayName,
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

        if (!user || !user.profile) {
            return null;
        }

        return {
            id: user.profile.id,
            userId: user.id,
            email: user.email,
            displayName: user.profile.displayName,
            bio: user.profile.bio,
            createdAt: user.profile.createdAt.toISOString(),
            updatedAt: user.profile.updatedAt.toISOString(),
        };
    }

    public async updateProfile(
        userId: string,
        displayName: string,
        bio: string | null
    ): Promise<PublicProfile | null> {
        const existingProfile = await getPrisma().profile.findUnique({
            where: { userId },
        });

        if (!existingProfile) {
            return null;
        }

        await getPrisma().profile.update({
            where: { userId },
            data: {
                displayName: displayName.trim(),
                bio,
            },
        });

        return this.getProfileByUserId(userId);
    }
}

const userStore = new UserStore();

export { UserStore, userStore };
