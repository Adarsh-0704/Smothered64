import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string): Promise<string>
{
    const salt = randomBytes(16).toString("hex");
    const derivedKey = await scrypt(password, salt, 64) as Buffer;
    return `${salt}:${derivedKey.toString("hex")}`;
}

export async function comparePassword(password: string, storedHash: string): Promise<boolean>
{
    const [salt, expectedHex] = storedHash.split(":");
    if (!salt || !expectedHex) return false;

    const expected = Buffer.from(expectedHex, "hex");
    const actual = await scrypt(password, salt, expected.length) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}
