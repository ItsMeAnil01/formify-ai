import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseQuestionsFile } from "../src/utils/importParser.js";

describe("parseQuestionsFile (CSV)", () => {
  test("parses a basic MCQ row with a correct answer", async () => {
    const csv = `Question,Option 1,Option 2,Option 3,Answer,Marks
What is 2+2?,3,4,5,4,2`;
    const questions = await parseQuestionsFile(Buffer.from(csv), "quiz.csv");
    assert.equal(questions.length, 1);
    assert.equal(questions[0].text, "What is 2+2?");
    assert.equal(questions[0].options.length, 3);
    assert.equal(questions[0].marks, 2);
    const correctOpt = questions[0].options.find((o) => o.id === questions[0].correctAnswer);
    assert.equal(correctOpt.text, "4");
  });

  test("falls back to short_text when no options are provided", async () => {
    const csv = `Question,Answer\nDescribe your role,`;
    const questions = await parseQuestionsFile(Buffer.from(csv), "quiz.csv");
    assert.equal(questions[0].type, "short_text");
    assert.equal(questions[0].options.length, 0);
  });

  test("handles quoted fields containing commas", async () => {
    const csv = `Question,Option 1,Option 2\n"Which is bigger, 3 or 5?",3,5`;
    const questions = await parseQuestionsFile(Buffer.from(csv), "quiz.csv");
    assert.equal(questions[0].text, "Which is bigger, 3 or 5?");
  });

  test("throws a clear error when there's no Question column", async () => {
    const csv = `Foo,Bar\n1,2`;
    await assert.rejects(() => parseQuestionsFile(Buffer.from(csv), "quiz.csv"), /Question/);
  });

  test("skips rows with an empty Question cell", async () => {
    const csv = `Question,Option 1\nReal question,A\n,B`;
    const questions = await parseQuestionsFile(Buffer.from(csv), "quiz.csv");
    assert.equal(questions.length, 1);
  });
});
