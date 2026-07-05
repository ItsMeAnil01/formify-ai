import express from "express";
import { register, login, getMe, verifyEmail, resendVerification, googleAuth } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/google", authLimiter, googleAuth);
router.get("/verify-email/:token", verifyEmail);
router.get("/me", protect, getMe);
router.post("/resend-verification", protect, resendVerification);

export default router;
