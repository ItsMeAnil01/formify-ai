import mongoose from "mongoose";
import { nanoid } from "nanoid";

const QUESTION_TYPES = [
  "short_text",
  "paragraph",
  "mcq_single",
  "mcq_multiple",
  "dropdown",
  "yes_no",
  "true_false",
  "rating_star",
  "rating_scale",
  "rating_emoji",
  "checkbox",
  "number",
  "email",
  "mobile",
  "date",
  "time",
  "url",
];

const optionSchema = new mongoose.Schema(
  { id: { type: String, default: () => nanoid(6) }, text: String },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => nanoid(8) },
    type: { type: String, enum: QUESTION_TYPES, required: true },
    text: { type: String, required: true },
    description: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    options: { type: [optionSchema], default: [] },
    // For mcq_single / yes_no / true_false / dropdown -> option id or literal value
    // For mcq_multiple / checkbox -> array of option ids
    correctAnswer: { type: mongoose.Schema.Types.Mixed, default: null },
    marks: { type: Number, default: 1 },
    negativeMarks: { type: Number, default: 0 },
    required: { type: Boolean, default: true },
    hint: { type: String, default: "" },
    explanation: { type: String, default: "" },
    shuffleOptions: { type: Boolean, default: false },
    characterLimit: { type: Number, default: null },
    placeholder: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    collectName: {
      type: String,
      enum: ["required", "optional", "hidden"],
      default: "required",
    },
    collectEmail: {
      type: String,
      enum: ["required", "optional", "hidden"],
      default: "optional",
    },
    collectMobile: {
      type: String,
      enum: ["required", "optional", "hidden"],
      default: "hidden",
    },
    anonymous: { type: Boolean, default: false },
    responseLimitMode: {
      type: String,
      enum: ["multiple", "one_per_email", "one_per_device"],
      default: "multiple",
    },
    autoGrade: { type: Boolean, default: false },
    passMarks: { type: Number, default: 0 },
    timeLimitMinutes: { type: Number, default: null },
    randomQuestions: { type: Boolean, default: false },
    randomOptions: { type: Boolean, default: false },
    instantResult: { type: Boolean, default: true },
    showCorrectAnswers: { type: Boolean, default: false },
    showExplanation: { type: Boolean, default: false },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    maxResponses: { type: Number, default: null },
  },
  { _id: false }
);

const formSchema = new mongoose.Schema(
  {
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, default: "Untitled Form" },
    description: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    category: { type: String, default: "" },
    tags: { type: [String], default: [] },
    mode: {
      type: String,
      enum: ["survey", "quiz", "feedback", "registration", "application", "exam", "custom"],
      default: "custom",
    },
    status: {
      type: String,
      enum: ["draft", "published", "closed", "archived"],
      default: "draft",
    },
    visibility: {
      type: String,
      enum: ["public", "private", "password", "unlisted"],
      default: "public",
    },
    accessPassword: { type: String, default: "" },
    slug: { type: String, unique: true, default: () => nanoid(10) },
    questions: { type: [questionSchema], default: [] },
    settings: { type: settingsSchema, default: () => ({}) },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

formSchema.methods.totalMarks = function () {
  return this.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
};

formSchema.methods.toPublicJSON = function () {
  // Strips correct answers / explanations before sending to respondents
  const obj = this.toObject();
  obj.questions = obj.questions.map((q) => {
    const { correctAnswer, explanation, ...rest } = q;
    return rest;
  });
  delete obj.accessPassword;
  return obj;
};

export const QUESTION_TYPE_LIST = QUESTION_TYPES;
export default mongoose.model("Form", formSchema);
