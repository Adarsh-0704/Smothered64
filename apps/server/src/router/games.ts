import { Router } from "express";
import { getGameHistory } from "../controllers/game.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/history", authenticate, getGameHistory);

export default router;
