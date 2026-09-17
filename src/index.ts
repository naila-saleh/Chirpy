import express, {type Express, NextFunction, type Request, type Response} from 'express';
import { config } from './config.js';
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { createUser, deleteAllUsers, getUserByEmail, updateUser, getUserById, upgradeUserToChirpyRed } from './db/queries/users.js'
import { createChirp, getAllChirps, getChirpById, deleteChirpById } from './db/queries/chirps.js';
import { createRefreshToken, getRefreshToken, revokeRefreshToken } from './db/queries/refreshTokens.js';
import { hashPassword, checkPasswordHash, makeJWT, validateJWT, getBearerToken, makeRefreshToken, getAPIKey } from './auth.js';


const migrationClient = postgres(config.db.url, { max: 1 });
await migrate(drizzle(migrationClient), config.db.migrationConfig);

const app: Express = express();
const port = config.api.port;

app.use(express.json());

function middlewareLogResponses (req: Request, res: Response, next: NextFunction): void{
    res.on("finish", () => {
        if(res.statusCode != 200){
            console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${res.statusCode}`);
        }
    });
    next();
}

function middlewareMetricsInc(req: Request, res: Response, next: NextFunction) {
    config.api.fileserverHits++;
    next();
}

app.use(middlewareLogResponses);

app.get("/admin/metrics", (req: Request, res: Response) => {
    res.contentType("text/html; charset=utf-8");
    res.send(`
    <html>
      <body>
        <h1>Welcome, Chirpy Admin</h1>
        <p>Chirpy has been visited ${config.api.fileserverHits} times!</p>
      </body>
    </html>`);
});

app.post("/admin/reset", async (req: Request, res: Response) => {
    const platform = config.api.platform;
    if(platform !== "dev") throw new ForbiddenError("Reset is only allowed in dev mode");
    config.api.fileserverHits = 0;
    await deleteAllUsers();
    res.contentType("text/plain; charset=utf-8");
    res.send("OK");
});

app.post("/api/chirps", async (req: Request, res: Response) => {
    const token = getBearerToken(req);
    let userId: string;
    try {
        userId = validateJWT(token, config.api.jwtSecret);
    } catch {
        throw new UnauthorizedError("Invalid token");
    }
    let chirp = req.body.body;
    if (typeof chirp !== "string") {
        throw new Error("Invalid chirp");
    }
    if (chirp.length > 140) {
        throw new BadRequestError("Chirp is too long. Max length is 140");
    }
    chirp = chirp.split(" ").map((word)=> {
        if (["kerfuffle", "sharbert", "fornax"].includes(word.toLowerCase())) {
            return "****";
        }
        return word;
    }).join(" ");
    chirp = await createChirp({ body: chirp, user_id: userId });
    res.status(201).json({
        id: chirp.id,
        body: chirp.body,
        createdAt: chirp.createdAt,
        updatedAt: chirp.updatedAt,
        userId: chirp.user_id,
    });
});

app.get("/api/chirps", async (req: Request, res: Response) => {
    let chirps = await getAllChirps();
    let authorId = "";
    let authorIdQuery = req.query.authorId;
    if (typeof authorIdQuery === "string") {
        authorId = authorIdQuery;
    }
    if (authorId) {
        chirps = chirps.filter((chirp) => chirp.user_id === authorId);
    }
    let sortOrder = "asc";
    let sortOrderQuery = req.query.sort;
    if (typeof sortOrderQuery === "string") {
        sortOrder = sortOrderQuery.toLowerCase();
    }
    if (sortOrder === "desc") {
        chirps = chirps.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    } else {
        chirps = chirps.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    }
    res.status(200).json(chirps.map((chirp) => ({
        id: chirp.id,
        body: chirp.body,
        createdAt: chirp.created_at,
        updatedAt: chirp.updated_at,
        userId: chirp.user_id,
    })));
});

app.get("/api/chirps/:chirpId", async (req: Request, res: Response) => {
    const chirpId = req.params.chirpId;
    if (!chirpId || typeof chirpId !== "string") {
        throw new BadRequestError("Chirp ID is required and must be a string");
    }
    const chirp = await getChirpById(chirpId);
    if (!chirp) {
        throw new NotFoundError("Chirp not found");
    }
    res.status(200).json({
        id: chirp.id,
        body: chirp.body,
        createdAt: chirp.created_at,
        updatedAt: chirp.updated_at,
        userId: chirp.user_id,
    });
});

app.delete("/api/chirps/:chirpId", async (req: Request, res: Response) => {
    let userId: string;
    try {
        const token = getBearerToken(req);
        userId = validateJWT(token, config.api.jwtSecret);
    } catch {
        throw new UnauthorizedError("Invalid token");
    }
    const chirpId = req.params.chirpId;
    if (!chirpId || typeof chirpId !== "string") {
        throw new BadRequestError("Chirp ID is required and must be a string");
    }
    const chirp = await getChirpById(chirpId);
    if (!chirp) {
        throw new NotFoundError("Chirp not found");
    }
    if (chirp.user_id !== userId) {
        throw new ForbiddenError("You are not allowed to delete this chirp");
    }
    await deleteChirpById(chirpId);
    res.status(204).send();
});

app.post("/api/polka/webhooks", async (req: Request, res: Response) => {
    let apiKey: string;
    try {
        apiKey = getAPIKey(req);
    } catch {
        throw new UnauthorizedError("Invalid API key");
    }
    if (apiKey !== config.api.polkaKey) {
        throw new UnauthorizedError("Invalid API key");
    }
    const { event, data } = req.body;
    if (!(event === "user.upgraded")) {
        return res.status(204).send();
    }
    const { userId } = data;
    if (!userId || typeof userId !== "string") {
        throw new BadRequestError("User ID is required and must be a string");
    }
    const user = await getUserById(userId);
    if (!user) {
        throw new NotFoundError("User not found");
    }
    const upgradedUser = await upgradeUserToChirpyRed(userId);
    res.status(204).send();
});

app.post("/api/users", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || typeof email !== "string") {
        throw new BadRequestError("Email is required and must be a string");
    }
    if (!password || typeof password !== "string") {
        throw new BadRequestError("Password is required and must be a string");
    }
    const hashed_password = await hashPassword(password);
    const user = await createUser({ email, hashed_password });
    res.status(201).json({
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        isChirpyRed: user.is_chirpy_red,
    });
});

app.put("/api/users", async (req: Request, res: Response) => {
    let userId: string;
    try {
        const token = getBearerToken(req);
        userId = validateJWT(token, config.api.jwtSecret);
    } catch {
        throw new UnauthorizedError("Invalid token");
    }
    const { email, password } = req.body;
    if (!email || typeof email !== "string") {
        throw new BadRequestError("Email is required and must be a string");
    }
    if (!password || typeof password !== "string") {
        throw new BadRequestError("Password is required and must be a string");
    }
    const hashed_password = await hashPassword(password);
    const user = await updateUser(userId, { email, hashed_password });
    res.status(200).json({
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        isChirpyRed: user.is_chirpy_red,
    });
});

app.post("/api/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || typeof email !== "string") {
        throw new BadRequestError("Email is required and must be a string");
    }
    if (!password || typeof password !== "string") {
        throw new BadRequestError("Password is required and must be a string");
    }
    const user = await getUserByEmail(email);
    if (!user) {
        throw new UnauthorizedError("incorrect email or password");
    }
    const isPasswordValid = await checkPasswordHash(password, user.hashed_password);
    if (!isPasswordValid) {
        throw new UnauthorizedError("incorrect email or password");
    }
    let expiresIn = 3600; // 1 hour
    const token = makeJWT(user.id, expiresIn, config.api.jwtSecret);
    const refreshTokenString = makeRefreshToken();
    const refreshToken = await createRefreshToken({
        token: refreshTokenString,
        user_id: user.id,
        expires_at: new Date(Date.now() + 60 * 60 * 24 * 60), // 60 days,
        revoked_at: null,
    });
    res.status(200).json({
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        token: token,
        refreshToken: refreshToken.token,
        isChirpyRed: user.is_chirpy_red,
    });
});

app.post("/api/refresh", async (req: Request, res: Response) => {
    const token = getBearerToken(req);
    const refreshToken = await getRefreshToken(token);
    if (!refreshToken) {
        throw new UnauthorizedError("Invalid refresh token");
    }
    if (refreshToken.expires_at < new Date()) {
        throw new UnauthorizedError("Refresh token has expired");
    }
    if (refreshToken.revoked_at) {
        throw new UnauthorizedError("Refresh token has been revoked");
    }
    const userId = refreshToken.user_id;
    const newToken = makeJWT(userId, 3600, config.api.jwtSecret);
    res.status(200).json({
        token: newToken,
    });
});

app.post("/api/revoke", async (req: Request, res: Response) => {
    const token = getBearerToken(req);
    const refreshToken = await getRefreshToken(token);
    if (!refreshToken) {
        throw new UnauthorizedError("Invalid refresh token");
    }
    if (refreshToken.expires_at < new Date()) {
        throw new UnauthorizedError("Refresh token has expired");
    }
    if (refreshToken.revoked_at) {
        throw new UnauthorizedError("Refresh token has been revoked");
    }
    await revokeRefreshToken(token);
    res.status(204).send();
});

app.use("/app", middlewareMetricsInc, express.static("./src/app"));

app.get("/api/healthz", (req: Request, res: Response) => {
    res.contentType("text/plain; charset=utf-8");
    res.send("OK");
});

class BadRequestError extends Error {
    constructor(message: string) {
        super(message);
    }
}

class UnauthorizedError extends Error {
    constructor(message: string) {
        super(message);
    }
}

class ForbiddenError extends Error {
    constructor(message: string) {
        super(message);
    }
}

class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
    }
}

function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction,
) {
    console.log(err);
    if(err instanceof BadRequestError){
        return res.status(400).json({
            error: err.message,
        });
    }else if(err instanceof UnauthorizedError){
        return res.status(401).json({
            error: err.message,
        });
    }else if(err instanceof ForbiddenError){
        return res.status(403).json({
            error: err.message,
        });
    }else if(err instanceof NotFoundError){
        return res.status(404).json({
            error: err.message,
        });
    }else {
        res.status(500).json({
            error: "Something went wrong on our end",
        });
    }
}

app.use(errorHandler);

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});