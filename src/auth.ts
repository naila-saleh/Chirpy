import argon2 from "argon2";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import type { Request } from "express";
import crypto from "crypto";

type payload = Pick<JwtPayload, "iss" | "sub" | "iat" | "exp">;
export function makeJWT(userID: string, expiresIn: number, secret: string): string {
    const iat = Math.floor(Date.now() / 1000);
    return jwt.sign({ iss: "chirpy", sub: userID, iat: iat, exp: iat+expiresIn }, secret);
}

export function validateJWT(tokenString: string, secret: string): string {
    const decoded = jwt.verify(tokenString, secret) as payload;
    if (!decoded.sub){
        throw new Error("Invalid token");
    }
    return decoded.sub;
}
export async function hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
}

export async function checkPasswordHash(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
}

export function getBearerToken(req: Request): string {
    const authHeader = req.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or invalid Authorization header");
    }
    return authHeader.substring(7);
}

export function makeRefreshToken(){
    return crypto.randomBytes(32).toString("hex");
}

export function getAPIKey(req: Request): string {
    const apiKey = req.get("Authorization");
    if (!apiKey || !apiKey.startsWith("ApiKey ")) {
        throw new Error("Missing or invalid Authorization header");
    }
    return apiKey.substring(7);
}