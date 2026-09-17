# Chirpy

## Overview

Chirpy is a REST API for sharing short text posts called chirps. It supports user accounts, token-based authentication, public chirp retrieval, and author-controlled deletion, with PostgreSQL persistence.

## Features

- User registration, login, and authenticated account updates.
- Argon2 password hashing, JWT authentication, and refresh-token revocation.
- Chirps with a 140-character limit, basic word filtering, and author-only deletion.
- Public chirp retrieval with author filtering and chronological sorting.
- Chirpy Red upgrades through an API-key-protected webhook.
- PostgreSQL persistence, static file serving, and request metrics.

## Tech Stack

Dependency versions below are recorded in `package-lock.json`.

| Technology | Version | Purpose |
| --- | --- | --- |
| Node.js | `24.20.0` in `.nvmrc` | Runtime |
| TypeScript | `7.0.2` | Application language |
| Express | `5.2.1` | HTTP routing and middleware |
| PostgreSQL | Not specified | Database |
| Drizzle ORM | `0.45.2` | Database schema and queries |
| Drizzle Kit | `0.31.10` | Migration generation and execution |
| Postgres.js | `3.4.9` | PostgreSQL client |
| Argon2 | `0.45.1` | Password hashing |
| jsonwebtoken | `9.0.3` | JWT signing and verification |
| Vitest | `3.2.7` | Unit testing |

## Project Structure

HTTP handlers in `src/index.ts` use shared authentication utilities and a separate database query layer.

```text
src/
├── index.ts             # Server startup, routes, middleware, error handling
├── config.ts            # Environment loading and application configuration
├── auth.ts              # Password hashing, JWTs, token and API key helpers
├── auth.test.ts         # Authentication utility tests
├── schema.ts            # Drizzle tables and inferred insert types
├── db/
│   ├── index.ts         # Database connection
│   ├── queries/         # User, chirp, and refresh-token persistence
│   └── migrations/      # SQL migrations and Drizzle metadata
└── app/                 # Static HTML and assets
drizzle.config.ts        # Drizzle Kit configuration
tsconfig.json           # TypeScript build configuration
```

## API Endpoints

Access JWTs and refresh tokens use `Authorization: Bearer <token>`. The webhook uses `Authorization: ApiKey <key>`.

| Method | Endpoint | Authentication / restriction | Description |
| --- | --- | --- | --- |
| GET | `/api/healthz` | None | Return plain-text `OK`. |
| POST | `/api/users` | None | Register with `email` and `password`. |
| PUT | `/api/users` | Access JWT | Update email and password (both required). |
| POST | `/api/login` | Email and password | Return user details, `token`, and `refreshToken`. |
| POST | `/api/refresh` | Refresh token | Issue a new access JWT. |
| POST | `/api/revoke` | Refresh token | Revoke an unexpired, active refresh token. |
| POST | `/api/chirps` | Access JWT | Create a chirp using the JSON `body` field. |
| GET | `/api/chirps` | None | List chirps; filter by `authorId`, order by `sort`. |
| GET | `/api/chirps/:chirpId` | None | Retrieve one chirp. |
| DELETE | `/api/chirps/:chirpId` | Access JWT; author only | Delete a chirp. |
| POST | `/api/polka/webhooks` | API key | Handle `user.upgraded` events to enable Chirpy Red. |
| GET | `/app/` and static files beneath it | None | Serve files from `src/app`. |
| GET | `/admin/metrics` | None | Show the in-memory `/app` request count. |
| POST | `/admin/reset` | None; requires `PLATFORM=dev` | Reset metrics; delete all users, chirps, and refresh tokens. |

Chirps sort by creation time in ascending order by default. Use `sort=desc` for newest first. Filtering uses `authorId=<user UUID>`.

Webhook payload: `{"event":"user.upgraded","data":{"userId":"<user UUID>"}}`.

## Getting Started

Use Node.js matching `.nvmrc`, npm, and a running PostgreSQL instance with an existing database. The PostgreSQL version is not specified. Run commands from the project root.

```bash
npm ci
```

Create a `.env` file in the project root with all five required variables. Replace the placeholders with your local configuration and keep real credentials out of version control.

```dotenv
PORT=8080
PLATFORM=dev
DB_URL=postgres://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/YOUR_DB_NAME
JWT_KEY=REPLACE_WITH_A_RANDOM_SECRET
POLKA_KEY=REPLACE_WITH_YOUR_WEBHOOK_API_KEY
```

`PORT` sets the HTTP port; `DB_URL` connects to PostgreSQL. `JWT_KEY` signs access tokens, and `POLKA_KEY` authenticates webhooks. `PLATFORM=dev` enables the unauthenticated, destructive `/admin/reset` endpoint.

### Run the server

```bash
npm run dev
```

This compiles TypeScript and starts the server. It does not watch files or reload automatically.

To build and start separately:

```bash
npm run build
npm start
```

With the example configuration, the server listens at `http://localhost:8080`.

## Database

PostgreSQL stores users, chirps, and refresh tokens. Deleting a user cascades to their chirps and tokens. Drizzle defines the schema in `src/schema.ts` and stores SQL migrations in `src/db/migrations`.

Pending migrations run automatically at server startup. To manage them explicitly:

```bash
npm run generate  # Generate a migration after schema changes
npm run migrate   # Apply pending migrations
```

## Example API Usage

These examples use `PORT=8080` and an example password. Replace `YOUR_ACCESS_TOKEN` with the login response’s `token`.

### Register and log in

```bash
curl -X POST http://localhost:8080/api/users \
  -H 'Content-Type: application/json' \
  -d '{"email":"naila@example.com","password":"example-password"}'

curl -X POST http://localhost:8080/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"naila@example.com","password":"example-password"}'
```

### Create and retrieve chirps

```bash
curl -X POST http://localhost:8080/api/chirps \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"body":"Hello, Chirpy!"}'

curl 'http://localhost:8080/api/chirps?sort=desc'
```

## Testing / Verification

```bash
npm test       # Run Vitest unit tests
npm run build  # Check TypeScript compilation
```

The seven authentication tests cover password verification, JWT validation, and Bearer-header parsing. They do not require a database.

With the server running, verify the HTTP health endpoint:

```bash
curl http://localhost:8080/api/healthz
```

Expected response: `OK`.

## Learning Context

Chirpy was developed as a guided project in Boot.dev’s **Learn HTTP Servers in TypeScript** course. It applies HTTP routing, REST API design, authentication, authorization, database persistence, migrations, and webhook handling.

## Author

Naila Saleh
