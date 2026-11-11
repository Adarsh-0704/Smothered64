import "dotenv/config";
import { createServer } from "node:http";
import express from "express";
import v1Router from "./router/v1.js";
import { createSocketServer } from "./socket/socket-server.js";

const app = express();
const httpServer = createServer(app);
const port = Number(process.env.PORT ?? 3001);
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    if (requestOrigin && (webOrigin === "*" || requestOrigin === webOrigin)) {
        res.setHeader("Access-Control-Allow-Origin", requestOrigin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }
    next();
});

app.use(express.json());
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/v1", v1Router);

const { io } = createSocketServer(httpServer, webOrigin);

httpServer.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

export { app, httpServer, io };
