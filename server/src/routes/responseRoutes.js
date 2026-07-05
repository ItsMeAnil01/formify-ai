import express from "express";
import { submitResponse } from "../controllers/responseController.js";
import { submitLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

// Public submission endpoint: POST /api/responses/:slug
router.post("/:slug", submitLimiter, submitResponse);

export default router;
