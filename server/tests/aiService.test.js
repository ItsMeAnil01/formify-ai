import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as ai from "../src/services/aiService.js";

describe("MODEL_CATALOG", () => {
  test("includes both Gemini models", () => {
    assert.ok(ai.MODEL_CATALOG["gemini-2.5-flash"]);
    assert.ok(ai.MODEL_CATALOG["gemini-3.5-flash"]);
    assert.equal(ai.MODEL_CATALOG["gemini-2.5-flash"].provider, "gemini");
    assert.equal(ai.MODEL_CATALOG["gemini-3.5-flash"].provider, "gemini");
  });

  test("includes at least one Claude model", () => {
    const claudeModels = Object.values(ai.MODEL_CATALOG).filter((m) => m.provider === "anthropic");
    assert.ok(claudeModels.length > 0);
  });
});

describe("model validation (no network calls — fails before any fetch)", () => {
  test("rejects an unrecognized model id with AIConfigError", async () => {
    await assert.rejects(
      () => ai.generateQuestions({ topic: "photosynthesis", model: "not-a-real-model" }),
      ai.AIConfigError
    );
  });

  test("rejects with AIDisabledError when the resolved provider has no API key set", async () => {
    // Neither ANTHROPIC_API_KEY nor GEMINI_API_KEY are set in the test environment,
    // so requesting a valid model should fail with "disabled", not a network error.
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(
      () => ai.generateQuestions({ topic: "photosynthesis", model: "gemini-2.5-flash" }),
      ai.AIDisabledError
    );
  });
});
