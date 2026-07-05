import asyncHandler from "express-async-handler";
import Form from "../models/Form.js";
import Response from "../models/Response.js";
import { toCSV, buildResponseRows } from "../utils/exportUtils.js";
import { gradeSubmission, computePassed } from "../utils/grading.js";

// @route POST /api/responses/:slug  (public submission)
export const submitResponse = asyncHandler(async (req, res) => {
  const form = await Form.findOne({ slug: req.params.slug });
  if (!form) {
    res.status(404);
    throw new Error("Form not found");
  }
  if (form.status !== "published") {
    res.status(403);
    throw new Error("This form is not currently accepting responses");
  }

  const { respondentName, respondentEmail, respondentMobile, answers, startedAt } = req.body;

  if (form.settings.collectName === "required" && !respondentName) {
    res.status(400);
    throw new Error("Name is required to submit this form");
  }
  if (form.settings.collectEmail === "required" && !respondentEmail) {
    res.status(400);
    throw new Error("Email is required to submit this form");
  }
  if (form.settings.collectMobile === "required" && !respondentMobile) {
    res.status(400);
    throw new Error("Mobile number is required to submit this form");
  }

  if (form.settings.responseLimitMode === "one_per_email" && respondentEmail) {
    const existing = await Response.findOne({ form: form._id, respondentEmail });
    if (existing) {
      res.status(409);
      throw new Error("A response from this email has already been submitted");
    }
  }

  const shouldGrade = form.mode === "quiz" || form.mode === "exam" || form.settings.autoGrade;

  const { gradedAnswers, score, maxScore } = gradeSubmission(form.questions, answers, shouldGrade);

  const submittedAt = new Date();
  const completionTimeSec = startedAt
    ? Math.max(0, Math.round((submittedAt - new Date(startedAt)) / 1000))
    : 0;

  const passed = computePassed(form.settings, shouldGrade, score, maxScore);

  const response = await Response.create({
    form: form._id,
    respondentName,
    respondentEmail,
    respondentMobile,
    answers: gradedAnswers,
    score,
    maxScore,
    passed,
    startedAt,
    submittedAt,
    completionTimeSec,
    device: req.headers["user-agent"] || "",
    ip: req.ip,
  });

  const result = {
    id: response._id,
    submittedAt: response.submittedAt,
  };

  if (shouldGrade && form.settings.instantResult) {
    result.score = score;
    result.maxScore = maxScore;
    result.passed = passed;
    if (form.settings.showCorrectAnswers) {
      result.correctAnswers = form.questions.map((q) => ({
        questionId: q.id,
        correctAnswer: q.correctAnswer,
        explanation: form.settings.showExplanation ? q.explanation : undefined,
      }));
    }
  }

  res.status(201).json({ response: result });
});

// @route GET /api/forms/:id/responses  (owner)
export const listResponses = asyncHandler(async (req, res) => {
  const form = await Form.findOne({ _id: req.params.id, creator: req.user._id });
  if (!form) {
    res.status(404);
    throw new Error("Form not found");
  }

  const responses = await Response.find({ form: form._id }).sort({ submittedAt: -1 });
  res.json({ responses });
});

// @route GET /api/forms/:id/analytics  (owner)
export const getAnalytics = asyncHandler(async (req, res) => {
  const form = await Form.findOne({ _id: req.params.id, creator: req.user._id });
  if (!form) {
    res.status(404);
    throw new Error("Form not found");
  }

  const responses = await Response.find({ form: form._id });
  const totalResponses = responses.length;

  const analytics = {
    totalResponses,
    totalViews: form.views,
    completionRate: form.views > 0 ? Math.round((totalResponses / form.views) * 100) : null,
    avgCompletionTimeSec: totalResponses
      ? Math.round(responses.reduce((s, r) => s + (r.completionTimeSec || 0), 0) / totalResponses)
      : 0,
  };

  const isGraded = form.mode === "quiz" || form.mode === "exam" || form.settings.autoGrade;
  if (isGraded && totalResponses) {
    const scores = responses.map((r) => r.score);
    analytics.averageScore = +(scores.reduce((s, v) => s + v, 0) / totalResponses).toFixed(2);
    analytics.highestScore = Math.max(...scores);
    analytics.lowestScore = Math.min(...scores);
    const passedCount = responses.filter((r) => r.passed).length;
    analytics.passPercent = +((passedCount / totalResponses) * 100).toFixed(1);
    analytics.failPercent = +(100 - analytics.passPercent).toFixed(1);
  }

  // Per-question breakdown (works for both graded and choice-based survey questions)
  analytics.questionBreakdown = form.questions.map((q) => {
    const relevantAnswers = responses
      .flatMap((r) => r.answers)
      .filter((a) => a.questionId === q.id);

    const breakdown = { questionId: q.id, text: q.text, type: q.type, responseCount: relevantAnswers.length };

    if (["mcq_single", "mcq_multiple", "dropdown", "checkbox", "yes_no", "true_false"].includes(q.type)) {
      const optionCounts = {};
      relevantAnswers.forEach((a) => {
        const values = Array.isArray(a.answer) ? a.answer : [a.answer];
        values.forEach((v) => {
          let label = v;
          if (["mcq_single", "mcq_multiple", "dropdown", "checkbox"].includes(q.type)) {
            const opt = q.options.find((o) => o.id === v);
            if (opt) label = opt.text;
          }
          optionCounts[label] = (optionCounts[label] || 0) + 1;
        });
      });
      breakdown.optionCounts = optionCounts;
    }

    if (["rating_star", "rating_scale", "rating_emoji", "number"].includes(q.type)) {
      const nums = relevantAnswers.map((a) => Number(a.answer)).filter((n) => !Number.isNaN(n));
      breakdown.average = nums.length ? +(nums.reduce((s, v) => s + v, 0) / nums.length).toFixed(2) : null;
    }

    if (isGraded && q.correctAnswer !== null && q.correctAnswer !== undefined) {
      const correctCount = relevantAnswers.filter((a) => a.isCorrect).length;
      breakdown.correctPercent = relevantAnswers.length
        ? +((correctCount / relevantAnswers.length) * 100).toFixed(1)
        : null;
    }

    return breakdown;
  });

  res.json({ analytics });
});

// @route GET /api/forms/:id/export.csv  (owner)
export const exportCsv = asyncHandler(async (req, res) => {
  const form = await Form.findOne({ _id: req.params.id, creator: req.user._id });
  if (!form) {
    res.status(404);
    throw new Error("Form not found");
  }

  const responses = await Response.find({ form: form._id }).sort({ submittedAt: -1 });
  const { headers, rows } = buildResponseRows(form, responses);
  const csv = toCSV(rows, headers);

  const safeFilename = form.title.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_") || "responses";
  const encodedFilename = encodeURIComponent(form.title.replace(/\s+/g, "_"));

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeFilename}_responses.csv"; filename*=UTF-8''${encodedFilename}_responses.csv`
  );
  res.send(csv);
});
