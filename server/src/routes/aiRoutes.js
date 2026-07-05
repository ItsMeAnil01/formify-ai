import express from "express";
import { protect } from "../middleware/auth.js";
import {
  listModels,
  generateQuestions,
  parsePaste,
  fixGrammar,
  detectDuplicates,
  summarizeQuestionResponses,
} from "../controllers/aiController.js";

const router = express.Router();

router.use(protect);

router.get("/models", listModels);
router.post("/generate-questions", generateQuestions);
router.post("/parse-paste", parsePaste);
router.post("/fix-grammar", fixGrammar);
router.get("/forms/:id/duplicates", detectDuplicates);
router.get("/forms/:id/questions/:questionId/summary", summarizeQuestionResponses);

export default router;
