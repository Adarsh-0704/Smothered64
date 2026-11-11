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

export type { AuthTokenPayload, PublicUser, UserKind };
