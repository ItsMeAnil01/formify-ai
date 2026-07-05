import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    answer: { type: mongoose.Schema.Types.Mixed },
    isCorrect: { type: Boolean, default: null },
    marksAwarded: { type: Number, default: 0 },
  },
  { _id: false }
);

const responseSchema = new mongoose.Schema(
  {
    form: { type: mongoose.Schema.Types.ObjectId, ref: "Form", required: true },
    respondentName: { type: String, default: "" },
    respondentEmail: { type: String, default: "" },
    respondentMobile: { type: String, default: "" },
    answers: { type: [answerSchema], default: [] },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    passed: { type: Boolean, default: null },
    startedAt: { type: Date },
    submittedAt: { type: Date, default: Date.now },
    completionTimeSec: { type: Number, default: 0 },
    device: { type: String, default: "" },
    browser: { type: String, default: "" },
    ip: { type: String, default: "" },
  },
  { timestamps: true }
);

responseSchema.index({ form: 1, respondentEmail: 1 });

export default mongoose.model("Response", responseSchema);
