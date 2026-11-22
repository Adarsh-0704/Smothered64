import { Router } from "express";
import authRouter from "./auth.js";
import gamesRouter from "./games.js";

const router = Router();

router.use("/auth", authRouter);
router.use("/games", gamesRouter);

export default router;
