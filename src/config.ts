import type { MigrationConfig } from "drizzle-orm/migrator";

process.loadEnvFile()

type APIConfig = {
    fileserverHits: number;
    port: number;
    platform: string;
    jwtSecret: string;
    polkaKey: string;
};

function envOrThrow(key: string): string{
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing environment variable: ${key}`);
    }
    return value;
}

const migrationConfig: MigrationConfig = {
    migrationsFolder: "./src/db/migrations",
};

type DBConfig = {
    url: string;
    migrationConfig: MigrationConfig;
};

export const config = {
    api: {
        fileserverHits: 0,
        port: Number(envOrThrow("PORT")),
        platform: envOrThrow("PLATFORM"),
        jwtSecret: envOrThrow("JWT_KEY"),
        polkaKey: envOrThrow("POLKA_KEY"),
    },
    db: {
        url: envOrThrow("DB_URL"),
        migrationConfig: migrationConfig,
    }
};