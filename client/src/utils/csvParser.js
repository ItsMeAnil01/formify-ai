/**
 * csvParser.js — Client-side CSV parser for FormForge question import.
 *
 * Expected CSV columns (header row required, order doesn't matter):
 *   question       - (required) The question text
 *   type           - (optional) mcq_single | mcq_multiple | short_text | paragraph |
 *                               true_false | yes_no | rating_star | rating_scale |
 *                               number | email | date | time | url
 *                               Defaults to "mcq_single" if options present, else "short_text"
 *   option1…option6 - MCQ options (leave blank if not needed)
 *   correct_answer  - Exact text of correct option. For mcq_multiple use pipe-separated:
 *                     "Option A|Option B". Leave blank for survey questions (no correct answer).
 *
 * Handles: quoted fields, commas inside quotes, Windows/Unix line endings, BOM markers.
 */

const randomId = () => Math.random().toString(36).slice(2, 10);

/* ────────────────────────────────────────────────────────────────
   RFC 4180 CSV tokeniser
   ──────────────────────────────────────────────────────────────── */
const parseCSVToRows = (text) => {
  // Strip BOM if present
  const clean = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => { row.push(field.trim()); field = ""; };
  const pushRow = () => { pushField(); if (row.some(Boolean)) rows.push(row); row = []; };

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') pushField();
      else if (ch === '\r' && next === '\n') { pushRow(); i++; }
      else if (ch === '\n' || ch === '\r') pushRow();
      else field += ch;
    }
  }
  // Handle last row without trailing newline
  pushField();
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

/* ────────────────────────────────────────────────────────────────
   Type aliases — accepts many natural-language spellings
   ──────────────────────────────────────────────────────────────── */
const TYPE_ALIASES = {
  mcq: "mcq_single", mcq_single: "mcq_single", "mcq single": "mcq_single",
  "single choice": "mcq_single", "multiple choice": "mcq_single", single: "mcq_single",
  mcq_multiple: "mcq_multiple", "mcq multiple": "mcq_multiple",
  "multi choice": "mcq_multiple", "multiple correct": "mcq_multiple", multi: "mcq_multiple",
  short: "short_text", short_text: "short_text", "short text": "short_text", text: "short_text",
  paragraph: "paragraph", long: "paragraph", "long text": "paragraph", essay: "paragraph",
  true_false: "true_false", "true false": "true_false", tf: "true_false", "true/false": "true_false",
  yes_no: "yes_no", "yes no": "yes_no", yn: "yes_no", "yes/no": "yes_no",
  rating: "rating_star", rating_star: "rating_star", star: "rating_star", stars: "rating_star",
  rating_scale: "rating_scale", scale: "rating_scale", "number scale": "rating_scale",
  number: "number", numeric: "number",
  email: "email", date: "date", time: "time", url: "url", link: "url",
};

const resolveType = (raw, hasOptions) => {
  if (!raw) return hasOptions ? "mcq_single" : "short_text";
  return TYPE_ALIASES[raw.toLowerCase().trim()] ?? (hasOptions ? "mcq_single" : "short_text");
};

/* ────────────────────────────────────────────────────────────────
   Main parse function
   ──────────────────────────────────────────────────────────────── */
export const parseCSV = (csvText) => {
  const rows = parseCSVToRows(csvText);

  if (rows.length < 2) {
    return {
      questions: [],
      errors: ["The CSV must have a header row and at least one data row."],
      warnings: [],
    };
  }

  // Normalise headers: lowercase, underscores, strip special chars
  const headers = rows[0].map((h) =>
    h.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  );

  const col = (name) => headers.indexOf(name);

  const qCol = col("question");
  if (qCol === -1) {
    return {
      questions: [],
      errors: ['Missing required "question" column. Check your header row.'],
      warnings: [],
    };
  }

  const typeCol = col("type");
  const correctCol = col("correct_answer");

  // Collect option columns: option1 … option9 (also accepts "option_1")
  const optionCols = [];
  for (let n = 1; n <= 9; n++) {
    const idx = col(`option${n}`) !== -1 ? col(`option${n}`) : col(`option_${n}`);
    if (idx !== -1) optionCols.push(idx);
  }

  const questions = [];
  const errors = [];
  const warnings = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const lineNum = r + 1;

    const questionText = (row[qCol] ?? "").trim();
    if (!questionText) {
      warnings.push(`Row ${lineNum}: empty question — skipped.`);
      continue;
    }

    const rawType = typeCol !== -1 ? (row[typeCol] ?? "").trim() : "";
    const rawCorrect = correctCol !== -1 ? (row[correctCol] ?? "").trim() : "";

    const optionTexts = optionCols.map((ci) => (row[ci] ?? "").trim()).filter(Boolean);
    const type = resolveType(rawType, optionTexts.length > 0);

    // Build options, marking correct ones
    const options = optionTexts.map((text) => {
      const id = randomId();
      let isCorrect = false;
      if (rawCorrect) {
        const correctList = rawCorrect.split("|").map((s) => s.trim().toLowerCase());
        isCorrect = correctList.includes(text.toLowerCase());
      }
      return { id, text, isCorrect };
    });

    // Resolve correctAnswer to option id(s) or literal string
    let correctAnswer = null;
    const correctOpts = options.filter((o) => o.isCorrect);
    if (type === "mcq_multiple" && correctOpts.length > 0) {
      correctAnswer = correctOpts.map((o) => o.id);
    } else if (correctOpts.length === 1) {
      correctAnswer = correctOpts[0].id;
    } else if ((type === "true_false" || type === "yes_no") && rawCorrect) {
      correctAnswer = rawCorrect.toLowerCase().trim();
    }

    // Strip internal flag
    const cleanOptions = options.map(({ isCorrect: _, ...rest }) => rest);

    questions.push({
      id: randomId(),
      type,
      text: questionText,
      description: "",
      options: cleanOptions,
      correctAnswer,
      marks: 1,
      negativeMarks: 0,
      required: true,
      hint: "",
      explanation: "",
      shuffleOptions: false,
    });
  }

  return { questions, errors, warnings };
};

/* ────────────────────────────────────────────────────────────────
   CSV Template generator — returns a Blob URL for download
   ──────────────────────────────────────────────────────────────── */
export const downloadCSVTemplate = () => {
  const lines = [
    // Header
    "question,type,option1,option2,option3,option4,correct_answer",
    // Survey MCQ — no correct answer
    "How satisfied are you with our customer support?,mcq_single,Very unsatisfied,Unsatisfied,Neutral,Satisfied,Very satisfied,",
    // Survey MCQ with correct answer (quiz style)
    "What is the capital of France?,mcq_single,London,Paris,Berlin,Madrid,Paris",
    // Multiple correct
    "Which of these are primary colours?,mcq_multiple,Red,Green,Blue,Yellow,Red|Blue|Yellow",
    // Yes / No
    "Would you recommend our product to a friend?,yes_no,,,,,yes",
    // True / False
    "The Earth revolves around the Sun.,true_false,,,,,true",
    // Open-ended
    "What is the main reason for your score?,short_text,,,,, ",
    // Paragraph
    "Tell us more about your experience.,paragraph,,,,, ",
    // Rating
    "How satisfied are you with this service?,rating_star,,,,, ",
  ];

  const csvContent = lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  // Trigger download
  const a = document.createElement("a");
  a.href = url;
  a.download = "formforge_questions_template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Release the object URL after a short delay
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

/** Legacy: still export getCSVTemplate for any existing references */
export const getCSVTemplate = downloadCSVTemplate;
