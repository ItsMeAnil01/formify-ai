import asyncHandler from "express-async-handler";
import Form from "../models/Form.js";
import Response from "../models/Response.js";
import * as ai from "../services/aiService.js";
import { mapAIQuestionToSchema } from "../utils/aiQuestionMapper.js";

const handleAIError = (res, err) => {
  if (err instanceof ai.AIDisabledError) {
    res.status(503);
    throw err;
  }
  if (err instanceof ai.AIConfigError) {
    res.status(400);
    throw err;
  }
  res.status(502);
  throw new Error(`AI request failed: ${err.message}`);
};

// @route GET /api/ai/models  — which models this server can use, for building a picker UI
export const listModels = asyncHandler(async (req, res) => {
  const models = Object.entries(ai.MODEL_CATALOG).map(([id, meta]) => ({
    id,
    label: meta.label,
    provider: meta.provider,
    configured:
      meta.provider === "anthropic" ? !!process.env.ANTHROPIC_API_KEY : !!process.env.GEMINI_API_KEY,
  }));
  res.json({ models, defaultProvider: process.env.AI_PROVIDER || "anthropic" });
});

// @route POST /api/ai/generate-questions  { paragraph?, topic?, count, types, model? }
export const generateQuestions = asyncHandler(async (req, res) => {
  const { paragraph, topic, count, types, model } = req.body;
  if (!paragraph && !topic) {
    res.status(400);
    throw new Error("Provide either a paragraph or a topic to generate questions from");
  }

  try {
    const drafts = await ai.generateQuestions({ paragraph, topic, count, types, model });
    res.json({ questions: drafts.map(mapAIQuestionToSchema) });
  } catch (err) {
    handleAIError(res, err);
  }
});

// @route POST /api/ai/parse-paste  { text, model? }
export const parsePaste = asyncHandler(async (req, res) => {
  const { text, model } = req.body;
  if (!text) {
    res.status(400);
    throw new Error("Paste some question text to parse");
  }

  try {
    const drafts = await ai.parsePastedQuestions(text, model);
    res.json({ questions: drafts.map(mapAIQuestionToSchema) });
  } catch (err) {
    handleAIError(res, err);
  }
});

// @route POST /api/ai/fix-grammar  { text, model? }
export const fixGrammar = asyncHandler(async (req, res) => {
  const { text, model } = req.body;
  if (!text) {
    res.status(400);
    throw new Error("Provide text to fix");
  }

  try {
    const corrected = await ai.fixGrammar(text, model);
    res.json({ text: corrected });
  } catch (err) {
    handleAIError(res, err);
  }
});

// @route GET /api/ai/forms/:id/duplicates  (owner)  ?model=
export const detectDuplicates = asyncHandler(async (req, res) => {
  const form = await Form.findOne({ _id: req.params.id, creator: req.user._id });
  if (!form) {
    res.status(404);
    throw new Error("Form not found");
  }

  if (form.questions.length < 2) {
    return res.json({ duplicateGroups: [] });
  }

  try {
    const duplicateGroups = await ai.detectDuplicateQuestions(form.questions, req.query.model);
    res.json({ duplicateGroups });
  } catch (err) {
    handleAIError(res, err);
  }
});

// @route GET /api/ai/forms/:id/questions/:questionId/summary  (owner)  ?model=
export const summarizeQuestionResponses = asyncHandler(async (req, res) => {
  const form = await Form.findOne({ _id: req.params.id, creator: req.user._id });
  if (!form) {
    res.status(404);
    throw new Error("Form not found");
  }

  const question = form.questions.find((q) => q.id === req.params.questionId);
  if (!question) {
    res.status(404);
    throw new Error("Question not found on this form");
  }

  const responses = await Response.find({ form: form._id });
  const answers = responses
    .flatMap((r) => r.answers)
    .filter((a) => a.questionId === question.id && typeof a.answer === "string" && a.answer.trim())
    .map((a) => a.answer);

  if (answers.length === 0) {
    return res.json({ summary: null, message: "No text responses yet to summarize" });
  }

  try {
    const summary = await ai.summarizeResponses({ questionText: question.text, answers, model: req.query.model });
    res.json({ summary });
  } catch (err) {
    handleAIError(res, err);
  }
});
