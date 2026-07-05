/**
 * pasteParser.js — rewritten for robustness
 *
 * Converts pasted text (ChatGPT output, markdown questionnaires, numbered lists)
 * into structured question objects matching the Formify.ai schema.
 *
 * Supported question patterns:
 *   ## 1. Question text        (markdown heading with optional number)
 *   ## Question text           (plain markdown heading)
 *   1. Question text           (numbered list)
 *   1) Question text           (numbered list variant)
 *   Q1. Question               (Q-prefixed)
 *
 * Supported option patterns (detected only AFTER a question line):
 *   () Option text             (radio, no correct answer — surveys)
 *   (X) Option text            (radio, marked correct — quizzes)
 *   (*) Option text            (radio, marked correct)
 *   [ ] Option text            (checkbox, no correct answer)
 *   [x] Option text            (checkbox, marked correct)
 *   a) Option text             (lettered)
 *   A. Option text             (lettered uppercase)
 *   - Option text              (bullet, only when inside a question)
 *   • Option text              (bullet)
 *
 * Special lines:
 *   ---  ***  ___             → separator, ignored
 *   # Title (top-level)       → extracted as suggested form title
 *   # Thank You               → ignored
 */

const randomId = () => Math.random().toString(36).slice(2, 10);

/* ────────────────────────────────────────────────────────────────
   Question-line detection
   ──────────────────────────────────────────────────────────────── */
const QUESTION_PATTERNS = [
  // ## 2. Question text   or   ## Question text
  /^#{1,3}\s+(?:\d+[\.\)]\s+)?(.+)$/,
  // 1. Question text   or   1) Question text
  /^\d+[\.\)]\s+(.+)$/,
  // Q1. Question   or   Q: Question
  /^[Qq](?:\d+)?[\.\):\s]\s*(.+)$/,
];

const tryParseQuestionLine = (trimmed) => {
  for (const pattern of QUESTION_PATTERNS) {
    const m = trimmed.match(pattern);
    if (m) {
      const text = m[1].trim();
      // Skip thank-you headings and very short text that's likely a stray match
      if (/^thank/i.test(text)) return null;
      if (text.length < 4) return null;
      return text;
    }
  }
  return null;
};

/* ────────────────────────────────────────────────────────────────
   Option-line detection (ONLY called when inside a question block)
   ──────────────────────────────────────────────────────────────── */
const tryParseOptionLine = (trimmed) => {
  if (!trimmed) return null;

  // () Not comfortable  /  (X) Correct  /  (*) Correct  /  (✓) Correct
  const radio = trimmed.match(/^\(\s*([xX*✓✔]?)\s*\)\s+(.+)$/);
  if (radio) return { text: radio[2].trim(), isCorrect: radio[1].length > 0 };

  // [ ] Option  /  [x] Option  /  [X] Option
  const checkbox = trimmed.match(/^\[\s*([xX*✓✔]?)\s*\]\s+(.+)$/);
  if (checkbox) return { text: checkbox[2].trim(), isCorrect: checkbox[1].length > 0 };

  // a) Option  /  A. Option  — single letter ONLY, avoid matching "a. There was a problem…"
  // Require the option text to NOT look like a question itself
  const lettered = trimmed.match(/^([a-dA-D])[\.\)]\s+(.+)$/);
  if (lettered) {
    const optText = lettered[2].trim();
    // Reject if it looks like another question (ends with ?)
    if (!optText.endsWith("?")) return { text: optText, isCorrect: false };
  }

  // - Option  /  • Option  /  – Option  (bullet)
  const bullet = trimmed.match(/^[-•–]\s+(.+)$/);
  if (bullet) return { text: bullet[1].trim(), isCorrect: false };

  return null;
};

/* ────────────────────────────────────────────────────────────────
   Type inference from collected options
   ──────────────────────────────────────────────────────────────── */
const inferType = (options) => {
  if (options.length === 0) return "short_text";

  const texts = options.map((o) => o.text.trim().toLowerCase());

  // Yes / No
  if (options.length === 2 && texts.every((t) => ["yes", "no"].includes(t)))
    return "yes_no";

  // True / False
  if (options.length === 2 && texts.every((t) => ["true", "false"].includes(t)))
    return "true_false";

  // Multiple options marked correct → mcq_multiple
  const correctCount = options.filter((o) => o.isCorrect).length;
  if (correctCount > 1) return "mcq_multiple";

  // Default — works for both surveys (correctAnswer=null) and quizzes (correctAnswer=id)
  return "mcq_single";
};

/* ────────────────────────────────────────────────────────────────
   Main parse function
   ──────────────────────────────────────────────────────────────── */
export const parsePastedText = (rawText) => {
  const lines = rawText.split(/\r?\n/);
  const questions = [];
  let suggestedTitle = null;

  let currentQuestion = null;
  let currentOptions = [];

  /* Commit the current question to the list */
  const commitQuestion = () => {
    if (!currentQuestion) return;

    const type = inferType(currentOptions);
    const correctOpts = currentOptions.filter((o) => o.isCorrect);

    let correctAnswer = null;
    if (type === "mcq_single" && correctOpts.length === 1)
      correctAnswer = correctOpts[0].id;
    else if (type === "mcq_multiple" && correctOpts.length > 0)
      correctAnswer = correctOpts.map((o) => o.id);

    // Build clean options (strip internal isCorrect flag)
    const options = currentOptions.map(({ isCorrect: _, ...rest }) => rest);

    questions.push({
      id: randomId(),
      type,
      text: currentQuestion,
      description: "",
      options,
      correctAnswer,
      marks: 1,
      negativeMarks: 0,
      required: true,
      hint: "",
      explanation: "",
      shuffleOptions: false,
    });

    currentQuestion = null;
    currentOptions = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip blank lines and separator lines
    if (!trimmed || /^[-*_]{3,}$/.test(trimmed)) continue;

    // Top-level single-# title (only before any question is found)
    if (/^#\s/.test(trimmed) && !currentQuestion && questions.length === 0) {
      const titleCandidate = trimmed.replace(/^#+\s+/, "").trim();
      if (!/^thank/i.test(titleCandidate) && titleCandidate.length > 2) {
        suggestedTitle = suggestedTitle ?? titleCandidate;
      }
      continue;
    }

    // Try as a question line
    const questionText = tryParseQuestionLine(trimmed);
    if (questionText) {
      commitQuestion();
      currentQuestion = questionText;
      continue;
    }

    // Try as an option line (only when inside a question)
    if (currentQuestion) {
      const opt = tryParseOptionLine(trimmed);
      if (opt) {
        currentOptions.push({ id: randomId(), ...opt });
        continue;
      }
    }
  }

  // Don't forget the last question
  commitQuestion();

  return { title: suggestedTitle, questions };
};

/* ────────────────────────────────────────────────────────────────
   Validation helper
   ──────────────────────────────────────────────────────────────── */
export const validateParsed = ({ questions }) => {
  if (!questions || questions.length === 0) {
    return {
      valid: false,
      message:
        "No questions detected. Make sure each question starts on its own line with a number (1. Question) or markdown heading (## Question).",
    };
  }
  return {
    valid: true,
    message: `${questions.length} question${questions.length !== 1 ? "s" : ""} detected`,
  };
};
