import { db } from "../index.js";
import { NewUser, users } from "../../schema.js";
import { eq } from "drizzle-orm";

export async function createUser(user: NewUser) {
    const [result] = await db
        .insert(users)
        .values(user)
        .onConflictDoNothing()
        .returning();
    return result;
}

export async function updateUser(id: string, user: Partial<NewUser>) {
    const [result] = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return result;
}

export async function deleteAllUsers() {
    await db.delete(users).execute();
}

export async function getUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
}

export async function getUserById(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
}

export async function upgradeUserToChirpyRed(id: string) {
    const [result] = await db.update(users).set({ is_chirpy_red: true }).where(eq(users.id, id)).returning();
    return result;
}