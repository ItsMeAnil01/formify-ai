import { nanoid } from "nanoid";

/**
 * Converts an AI-generated draft (options as plain text, correct answer as text)
 * into a question object matching the Form model's question schema (option ids,
 * correctAnswer referencing an option id or literal value).
 */
export const mapAIQuestionToSchema = (draft) => {
  const options = (draft.options || []).map((o) => ({ id: nanoid(6), text: o.text }));

  let correctAnswer = null;
  if (draft.correctAnswerText !== undefined && draft.correctAnswerText !== null) {
    if (["true", "false", "yes", "no"].includes(String(draft.correctAnswerText).toLowerCase())) {
      correctAnswer = String(draft.correctAnswerText).toLowerCase();
    } else {
      const match = options.find(
        (o) => o.text.trim().toLowerCase() === String(draft.correctAnswerText).trim().toLowerCase()
      );
      correctAnswer = match ? match.id : null;
    }
  }

  return {
    id: nanoid(8),
    type: draft.type || "short_text",
    text: draft.text || "",
    description: "",
    options,
    correctAnswer,
    marks: 1,
    negativeMarks: 0,
    required: true,
    hint: "",
    explanation: "",
    shuffleOptions: false,
  };
};
