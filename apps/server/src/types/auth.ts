type UserKind = "guest" | "registered";

interface PublicUser {
    readonly id: string;
    readonly displayName: string;
    readonly kind: UserKind;
    readonly createdAt: string;
}

interface AuthTokenPayload {
    readonly userId: string;
    readonly userKind: UserKind;
    readonly iat?: number;
    readonly exp?: number;
}

interface PublicProfile {
    readonly id: string;
    readonly userId: string;
    readonly email: string;
    readonly displayName: string;
    readonly bio: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
}

export type { AuthTokenPayload, PublicProfile, PublicUser, UserKind };
