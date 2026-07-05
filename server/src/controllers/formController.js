import asyncHandler from "express-async-handler";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Form from "../models/Form.js";
import Response from "../models/Response.js";
import { parseQuestionsFile } from "../utils/importParser.js";

// @route POST /api/forms
export const createForm = asyncHandler(async (req, res) => {
  const { title, mode } = req.body;

  const form = await Form.create({
    creator: req.user._id,
    title: title || "Untitled Form",
    mode: mode || "custom",
  });

  res.status(201).json({ form });
});

// @route GET /api/forms  (creator's own forms + dashboard summary)
export const listForms = asyncHandler(async (req, res) => {
  const forms = await Form.find({ creator: req.user._id }).sort({ updatedAt: -1 });

  const formIds = forms.map((f) => f._id);
  const responseCounts = await Response.aggregate([
    { $match: { form: { $in: formIds } } },
    { $group: { _id: "$form", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(responseCounts.map((r) => [r._id.toString(), r.count]));

  const formsWithCounts = forms.map((f) => ({
    ...f.toObject(),
    responseCount: countMap[f._id.toString()] || 0,
  }));

  const stats = {
    totalForms: forms.length,
    activeForms: forms.filter((f) => f.status === "published").length,
    draftForms: forms.filter((f) => f.status === "draft").length,
    totalResponses: responseCounts.reduce((sum, r) => sum + r.count, 0),
    totalViews: forms.reduce((sum, f) => sum + (f.views || 0), 0),
  };

  res.json({ forms: formsWithCounts, stats });
});

// @route GET /api/forms/:id  (owner view, full detail incl. correct answers)
export const getForm = asyncHandler(async (req, res) => {
  const form = await Form.findOne({ _id: req.params.id, creator: req.user._id });
  if (!form) {
    res.status(404);
    throw new Error("Form not found");
  }
  res.json({ form });
});

// @route PUT /api/forms/:id
export const updateForm = asyncHandler(async (req, res) => {
  const form = await Form.findOne({ _id: req.params.id, creator: req.user._id });
  if (!form) {
    res.status(404);
    throw new Error("Form not found");
  }

  const editable = [
    "title",
    "description",
    "coverImage",
    "category",
    "tags",
    "mode",
    "visibility",
    "questions",
    "settings",
  ];
  editable.forEach((field) => {
    if (req.body[field] !== undefined) form[field] = req.body[field];
  });

  if (req.body.accessPassword) {
    form.accessPassword = await bcrypt.hash(req.body.accessPassword, 10);
  }

  await form.save();
  res.json({ form });
});

// @route PATCH /api/forms/:id/status  { status: draft|published|closed|archived }
export const setFormStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ["draft", "published", "closed", "archived"];
  if (!allowed.includes(status)) {
    res.status(400);
    throw new Error("Invalid status value");
  }

  const form = await Form.findOne({ _id: req.params.id, creator: req.user._id });
  if (!form) {
    res.status(404);
    throw new Error("Form not found");
  }

  form.status = status;
  await form.save();
  res.json({ form });
});

// @route DELETE /api/forms/:id
export const deleteForm = asyncHandler(async (req, res) => {
  const form = await Form.findOneAndDelete({ _id: req.params.id, creator: req.user._id });
  if (!form) {
    res.status(404);
    throw new Error("Form not found");
  }
  await Response.deleteMany({ form: form._id });
  res.json({ message: "Form deleted" });
});

// @route POST /api/forms/:id/duplicate
export const duplicateForm = asyncHandler(async (req, res) => {
  const original = await Form.findOne({ _id: req.params.id, creator: req.user._id });
  if (!original) {
    res.status(404);
    throw new Error("Form not found");
  }

  const clone = original.toObject();
  delete clone._id;
  delete clone.slug;
  delete clone.createdAt;
  delete clone.updatedAt;
  clone.title = `${clone.title} (Copy)`;
  clone.status = "draft";
  clone.views = 0;

  const newForm = await Form.create(clone);
  res.status(201).json({ form: newForm });
});

// @route GET /api/forms/public/:slug  (respondent access, no auth)
export const getPublicForm = asyncHandler(async (req, res) => {
  const form = await Form.findOne({ slug: req.params.slug });
  if (!form) {
    res.status(404);
    throw new Error("This form link is invalid or no longer exists");
  }

  // Check if request is sent by the form creator (preview mode)
  let isCreator = false;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    try {
      const token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.id && String(decoded.id) === String(form.creator)) {
        isCreator = true;
      }
    } catch (err) {
      // Ignore token decode failures — treat as public respondent
    }
  }

  if (!isCreator) {
    if (form.status === "draft" || form.status === "archived") {
      res.status(403);
      throw new Error("This form is not currently accepting responses");
    }

    if (form.status === "closed") {
      res.status(403);
      throw new Error("This form is closed and no longer accepting responses");
    }

    const now = new Date();
    if (form.settings.startDate && now < new Date(form.settings.startDate)) {
      res.status(403);
      throw new Error("This form hasn't opened yet");
    }
    if (form.settings.endDate && now > new Date(form.settings.endDate)) {
      res.status(403);
      throw new Error("This form has expired");
    }
  }

  if (form.visibility === "password") {
    const providedPassword = req.query.password;
    const valid =
      providedPassword && form.accessPassword
        ? await bcrypt.compare(providedPassword, form.accessPassword)
        : false;
    if (!valid) {
      return res.status(401).json({ requiresPassword: true });
    }
  }

  if (form.settings.maxResponses) {
    const count = await Response.countDocuments({ form: form._id });
    if (count >= form.settings.maxResponses) {
      res.status(403);
      throw new Error("This form has reached its maximum number of responses");
    }
  }

  form.views += 1;
  await form.save();

  res.json({ form: form.toPublicJSON() });
});

// @route POST /api/forms/:id/import-questions  (multipart file upload, field name "file")
export const importQuestions = asyncHandler(async (req, res) => {
  const form = await Form.findOne({ _id: req.params.id, creator: req.user._id });
  if (!form) {
    res.status(404);
    throw new Error("Form not found");
  }
  if (!req.file) {
    res.status(400);
    throw new Error("Attach a CSV or Excel file under the 'file' field");
  }

  let imported;
  try {
    imported = await parseQuestionsFile(req.file.buffer, req.file.originalname);
  } catch (err) {
    res.status(400);
    throw new Error(err.message);
  }

  form.questions = [...form.questions, ...imported];
  await form.save();

  res.json({ form, importedCount: imported.length });
});

// @route POST /api/forms/upload-image  (multipart file upload, field name "image")
export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("Attach an image under the 'image' field");
  }
  res.status(201).json({ url: `/uploads/images/${req.file.filename}` });
});
