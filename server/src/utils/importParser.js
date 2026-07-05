import ExcelJS from "exceljs";
import { nanoid } from "nanoid";

// Minimal RFC4180-ish CSV parser — handles quoted fields, escaped quotes, and commas/newlines within quotes.
const parseCSV = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
};

const rowsToObjects = (rows) => {
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = r[i] !== undefined ? String(r[i]).trim() : "";
    });
    return obj;
  });
};

const readExcel = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The uploaded file has no sheets/data");

  const rows = [];
  sheet.eachRow((row) => {
    // row.values[0] is undefined (ExcelJS is 1-indexed); slice it off
    rows.push(row.values.slice(1).map((v) => (v === null || v === undefined ? "" : String(v))));
  });
  return rowsToObjects(rows);
};

/**
 * Expected columns (case-insensitive, order doesn't matter):
 *   Question       (required)
 *   Type           (optional: mcq_single | mcq_multiple | short_text | true_false | yes_no — default mcq_single)
 *   Option 1..6    (optional, used for mcq_* types)
 *   Answer         (optional — text of the correct option, or true/false/yes/no)
 *   Marks          (optional, default 1)
 */
export const parseQuestionsFile = async (buffer, originalName = "") => {
  const isExcel = /\.(xlsx|xls)$/i.test(originalName);
  const rows = isExcel ? await readExcel(buffer) : rowsToObjects(parseCSV(buffer.toString("utf-8")));

  if (rows.length === 0) throw new Error("No rows found in the uploaded file");

  const getField = (row, name) => {
    const key = Object.keys(row).find((k) => k.trim().toLowerCase() === name.toLowerCase());
    return key ? String(row[key]).trim() : "";
  };

  const questions = rows
    .map((row) => {
      const text = getField(row, "Question");
      if (!text) return null;

      const type = getField(row, "Type").toLowerCase() || "mcq_single";
      const answer = getField(row, "Answer");
      const marks = Number(getField(row, "Marks")) || 1;

      const options = [];
      for (let i = 1; i <= 6; i += 1) {
        const optText = getField(row, `Option ${i}`);
        if (optText) options.push({ id: nanoid(6), text: optText });
      }

      let correctAnswer = null;
      if (answer) {
        if (["true", "false", "yes", "no"].includes(answer.toLowerCase())) {
          correctAnswer = answer.toLowerCase();
        } else {
          const match = options.find((o) => o.text.trim().toLowerCase() === answer.toLowerCase());
          correctAnswer = match ? match.id : null;
        }
      }

      return {
        id: nanoid(8),
        type: options.length ? type : "short_text",
        text,
        description: "",
        options,
        correctAnswer,
        marks,
        negativeMarks: 0,
        required: true,
        hint: "",
        explanation: "",
        shuffleOptions: false,
      };
    })
    .filter(Boolean);

  if (questions.length === 0) {
    throw new Error("Couldn't find any valid questions — make sure there's a 'Question' column");
  }

  return questions;
};
