import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { toCSV, buildResponseRows } from "../src/utils/exportUtils.js";

describe("toCSV", () => {
  test("joins headers and rows with commas and newlines", () => {
    const csv = toCSV([["a", "b"], ["c", "d"]], ["H1", "H2"]);
    assert.equal(csv, "H1,H2\na,b\nc,d");
  });

  test("quotes and escapes values containing commas, quotes, or newlines", () => {
    const csv = toCSV([['She said "hi", once\nokay']], ["Notes"]);
    assert.equal(csv, 'Notes\n"She said ""hi"", once\nokay"');
  });

  test("empty/null/undefined values become empty strings", () => {
    const csv = toCSV([[null, undefined, ""]], ["A", "B", "C"]);
    assert.equal(csv, "A,B,C\n,,");
  });
});

describe("buildResponseRows", () => {
  const form = {
    mode: "quiz",
    questions: [
      { id: "q1", text: "What is 2+2?" },
      { id: "q2", text: "Pick fruits" },
    ],
  };

  test("adds Score/Max Score/Passed columns for graded modes", () => {
    const responses = [
      {
        respondentName: "Anil",
        respondentEmail: "anil@example.com",
        respondentMobile: "9999999999",
        submittedAt: new Date("2026-01-01T00:00:00Z"),
        completionTimeSec: 42,
        score: 4,
        maxScore: 5,
        passed: true,
        answers: [
          { questionId: "q1", answer: "4" },
          { questionId: "q2", answer: ["apple", "mango"] },
        ],
      },
    ];

    const { headers, rows } = buildResponseRows(form, responses);
    assert.ok(headers.includes("Score"));
    assert.ok(headers.includes("Max Score"));
    assert.ok(headers.includes("Passed"));
    assert.equal(rows[0][rows[0].length - 2], "4"); // Pick fruits answer joined
    assert.equal(rows[0].includes("Yes"), true); // Passed -> "Yes"
  });

  test("does not add grading columns for a plain survey", () => {
    const surveyForm = { mode: "survey", questions: [{ id: "q1", text: "Rate us" }] };
    const responses = [
      {
        respondentName: "Anil",
        respondentEmail: "",
        respondentMobile: "",
        submittedAt: new Date(),
        completionTimeSec: 10,
        answers: [{ questionId: "q1", answer: "5" }],
      },
    ];
    const { headers } = buildResponseRows(surveyForm, responses);
    assert.equal(headers.includes("Score"), false);
  });

  test("joins array answers with semicolons", () => {
    const responses = [
      {
        respondentName: "",
        respondentEmail: "",
        respondentMobile: "",
        submittedAt: new Date(),
        completionTimeSec: 0,
        score: 0,
        maxScore: 0,
        passed: null,
        answers: [{ questionId: "q2", answer: ["a", "b", "c"] }],
      },
    ];
    const { rows } = buildResponseRows(form, responses);
    assert.equal(rows[0][rows[0].length - 1], "a; b; c");
  });
});
