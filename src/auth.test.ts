import { describe, it, expect, beforeAll } from "vitest";
import { makeJWT, validateJWT, checkPasswordHash, hashPassword, getBearerToken } from "./auth.js";
import type { Request } from "express";

describe("Password Hashing", () => {
    const password1 = "correctPassword123!";
    const password2 = "anotherPassword456!";
    let hash1: string;
    let hash2: string;

    beforeAll(async () => {
        hash1 = await hashPassword(password1);
        hash2 = await hashPassword(password2);
    });

    it("should return true for the correct password", async () => {
        const result = await checkPasswordHash(password1, hash1);
        expect(result).toBe(true);
    });

    it("should create and validate a JWT", () => {
        const token = makeJWT("testUserID", 3600, "testSecret");
        const userID = validateJWT(token, "testSecret");
        expect(userID).toBe("testUserID");
    });

    it("should reject an expired JWT", () => {
        const token = makeJWT("testUserID", -1, "testSecret");
        expect(() => validateJWT(token, "testSecret")).toThrow("jwt expired");
    });

    it("should reject a JWT signed with the wrong secret", () => {
        const token = makeJWT("testUserID", 3600, "testSecret");
        expect(() => validateJWT(token, "wrongSecret")).toThrow("invalid signature");
    });

    it("should extract the bearer token from the Authorization header", () => {
        const mockRequest = {
            get: (header: string) => {
                if (header === "Authorization") {
                    return "Bearer testToken123";
                }
                return undefined;
            }
        } as unknown as Request;

        const token = getBearerToken(mockRequest);
        expect(token).toBe("testToken123");
    });

    it("should throw an error if the Authorization header is missing", () => {
        const mockRequest = {
            get: (header: string) => {
                if (header === "Authorization") {
                    return undefined;
                }
                return undefined;
            }
        } as unknown as Request;

        expect(() => getBearerToken(mockRequest)).toThrow("Missing or invalid Authorization header");
    });

    it("should throw an error if the Authorization header does not start with 'Bearer '", () => {
        const mockRequest = {
            get: (header: string) => {
                if (header === "Authorization") {
                    return "testToken123";
                }
                return undefined;
            }
        } as unknown as Request;

        expect(() => getBearerToken(mockRequest)).toThrow("Missing or invalid Authorization header");
    });

});