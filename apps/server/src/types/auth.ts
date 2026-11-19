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
    readonly userId: string;
    readonly email: string;
    readonly username: string;
    readonly avatarUrl: string | null;
    readonly bio: string | null;
    readonly country: string | null;
    readonly dateOfBirth: string | null;
}

export type { AuthTokenPayload, PublicProfile, PublicUser, UserKind };
