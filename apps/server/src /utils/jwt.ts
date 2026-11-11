import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
}

export function generateToken(userId: string) {
    return jwt.sign(
        { userId },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
}

export function verifyToken(token: string) {
    return jwt.verify(token, JWT_SECRET);
}