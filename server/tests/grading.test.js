import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { arraysEqualAsSets, gradeQuestion, gradeSubmission, computePassed } from "../src/utils/grading.js";

describe("arraysEqualAsSets", () => {
  test("true for same elements, different order", () => {
    assert.equal(arraysEqualAsSets(["a", "b"], ["b", "a"]), true);
  });
  test("false for different lengths", () => {
    assert.equal(arraysEqualAsSets(["a", "b"], ["a"]), false);
  });
  test("false when one side is not an array", () => {
    assert.equal(arraysEqualAsSets("a", ["a"]), false);
  });
  test("true for two empty arrays", () => {
    assert.equal(arraysEqualAsSets([], []), true);
  });
});

describe("gradeQuestion", () => {
  test("ungraded when correctAnswer is null", () => {
    const q = { correctAnswer: null, marks: 5 };
    assert.deepEqual(gradeQuestion(q, "anything"), { isCorrect: null, marksAwarded: 0 });
  });

  test("single-answer correct match awards marks", () => {
    const q = { correctAnswer: "opt1", marks: 4, negativeMarks: 1 };
    assert.deepEqual(gradeQuestion(q, "opt1"), { isCorrect: true, marksAwarded: 4 });
  });

  test("single-answer incorrect match applies negative marking", () => {
    const q = { correctAnswer: "opt1", marks: 4, negativeMarks: 1 };
    assert.deepEqual(gradeQuestion(q, "opt2"), { isCorrect: false, marksAwarded: -1 });
  });

  test("single-answer incorrect with no negative marking configured", () => {
    const q = { correctAnswer: "opt1", marks: 4 };
    assert.deepEqual(gradeQuestion(q, "opt2"), { isCorrect: false, marksAwarded: -0 });
  });

  test("multi-answer (set) correct match awards marks regardless of order", () => {
    const q = { correctAnswer: ["a", "b"], marks: 2 };
    assert.deepEqual(gradeQuestion(q, ["b", "a"]), { isCorrect: true, marksAwarded: 2 });
  });

  test("multi-answer partial match counts as incorrect (all-or-nothing)", () => {
    const q = { correctAnswer: ["a", "b"], marks: 2, negativeMarks: 1 };
    assert.deepEqual(gradeQuestion(q, ["a"]), { isCorrect: false, marksAwarded: -1 });
  });

  test("boolean-style correctAnswer stored as string compares correctly", () => {
    const q = { correctAnswer: "true", marks: 1 };
    assert.deepEqual(gradeQuestion(q, "true"), { isCorrect: true, marksAwarded: 1 });
    assert.deepEqual(gradeQuestion(q, "false"), { isCorrect: false, marksAwarded: -0 });
  });
});

describe("gradeSubmission", () => {
  const questions = [
    { id: "q1", correctAnswer: "a", marks: 2, negativeMarks: 1 },
    { id: "q2", correctAnswer: ["x", "y"], marks: 3, negativeMarks: 0 },
    { id: "q3", correctAnswer: null, marks: 1 }, // ungraded short-answer type
  ];

  test("scores a mixed submission correctly when shouldGrade is true", () => {
    const answers = [
      { questionId: "q1", answer: "a" }, // correct: +2
      { questionId: "q2", answer: ["y", "x"] }, // correct: +3
      { questionId: "q3", answer: "some free text" }, // ungraded: +0
    ];
    const { score, maxScore, gradedAnswers } = gradeSubmission(questions, answers, true);
    assert.equal(score, 5);
    assert.equal(maxScore, 6);
    assert.equal(gradedAnswers.find((a) => a.questionId === "q1").isCorrect, true);
    assert.equal(gradedAnswers.find((a) => a.questionId === "q3").isCorrect, null);
  });

  test("does not attach isCorrect/marksAwarded fields when shouldGrade is false", () => {
    const answers = [{ questionId: "q1", answer: "a" }];
    const { gradedAnswers, score } = gradeSubmission(questions, answers, false);
    assert.equal(score, 0);
    assert.equal("isCorrect" in gradedAnswers[0], false);
  });

  test("ignores answers for question ids that no longer exist on the form", () => {
    const answers = [{ questionId: "deleted_question", answer: "x" }];
    const { gradedAnswers, maxScore } = gradeSubmission(questions, answers, true);
    assert.equal(maxScore, 0);
    assert.equal(gradedAnswers.length, 1);
  });

  test("penalty on a wrong answer can make the running score negative", () => {
    const answers = [{ questionId: "q1", answer: "wrong" }];
    const { score } = gradeSubmission(questions, answers, true);
    assert.equal(score, -1);
  });
});

describe("computePassed", () => {
  test("null when the form isn't graded", () => {
    assert.equal(computePassed({}, false, 10, 10), null);
  });
  test("uses explicit passMarks when set", () => {
    assert.equal(computePassed({ passMarks: 5 }, true, 4, 10), false);
    assert.equal(computePassed({ passMarks: 5 }, true, 5, 10), true);
  });
  test("falls back to 50% when passMarks is 0/unset", () => {
    assert.equal(computePassed({ passMarks: 0 }, true, 4, 10), false);
    assert.equal(computePassed({ passMarks: 0 }, true, 5, 10), true);
  });
});
