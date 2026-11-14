import { Router } from "express";
import {
    createGuest,
    getProfile,
    login,
    logout,
    me,
    register,
    updateProfile,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/guest", createGuest);
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", authenticate, me);

router.get("/profile", authenticate, getProfile);
router.patch("/profile", authenticate, updateProfile);

export default router;