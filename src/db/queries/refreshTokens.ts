import { db } from "../index.js";
import { NewRefreshToken, refresh_tokens } from "../../schema.js";
import { eq } from "drizzle-orm";

export async function createRefreshToken(token: NewRefreshToken) {
    const [result] = await db.insert(refresh_tokens).values(token).returning();
    return result;
}

export async function getRefreshToken(token: string) {
    const result = await db.select().from(refresh_tokens).where(eq(refresh_tokens.token, token));
    return result[0];
}

export async function revokeRefreshToken(token: string) {
    return await db.update(refresh_tokens).set({ revoked_at: new Date(), updated_at: new Date() }).where(eq(refresh_tokens.token, token)).returning();
}