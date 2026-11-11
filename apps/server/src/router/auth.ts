import { Router } from "express";
import { createGuest, login, me, register } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/guest", createGuest);
router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticate, me);

export default router;
