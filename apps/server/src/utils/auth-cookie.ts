import type { Response } from "express";

const COOKIE_NAME = "smothered_token";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

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

function clearAuthCookie(res: Response): void {
    res.clearCookie(COOKIE_NAME, cookieOptions);
}

export { clearAuthCookie, setAuthCookie };
