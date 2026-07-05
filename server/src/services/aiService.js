// AI provider layer — supports Anthropic Claude and Google Gemini interchangeably.
//
// Which one runs is controlled by env vars (see server/.env.example):
//   AI_PROVIDER=anthropic | gemini     (default: anthropic)
//   AI_MODEL=<model id>                (optional override of the default model below)
//
// Any individual request can also override the model by passing a `model` field —
// see MODEL_CATALOG for the whitelist of accepted values.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const GEMINI_URL = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// Whitelist of models the app will accept, mapped to which provider/API they belong to.
// Add a new model here (and nowhere else) to make it selectable.
export const MODEL_CATALOG = {
  "claude-sonnet-4-5": { provider: "anthropic", label: "Claude Sonnet 4.5" },
  "claude-haiku-4-5": { provider: "anthropic", label: "Claude Haiku 4.5 (fastest/cheapest Claude)" },
  "gemini-2.5-flash": { provider: "gemini", label: "Gemini 2.5 Flash" },
  "gemini-3.5-flash": { provider: "gemini", label: "Gemini 3.5 Flash (strongest reasoning)" },
};

class AIDisabledError extends Error {}
class AIConfigError extends Error {}

const resolveModel = (requestedModel) => {
  // Read lazily so the correct .env values are always used after a restart
  const defaultProvider = process.env.AI_PROVIDER || "gemini";
  const defaultModel =
    process.env.AI_MODEL ||
    (defaultProvider === "gemini" ? "gemini-2.5-flash" : "claude-sonnet-4-5");

  const model = requestedModel || defaultModel;
  const entry = MODEL_CATALOG[model];
  if (!entry) {
    throw new AIConfigError(
      `Unknown model "${model}". Supported models: ${Object.keys(MODEL_CATALOG).join(", ")}`
    );
  }
  return { model, provider: entry.provider };
};

const assertConfigured = (provider) => {
  if (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
    throw new AIDisabledError(
      "Claude is not configured. Set ANTHROPIC_API_KEY in server/.env, or switch AI_PROVIDER to 'gemini'."
    );
  }
  if (provider === "gemini" && !process.env.GEMINI_API_KEY) {
    throw new AIDisabledError(
      "Gemini is not configured. Set GEMINI_API_KEY in server/.env, or switch AI_PROVIDER to 'anthropic'."
    );
  }
};

const callAnthropic = async ({ model, system, prompt, maxTokens }) => {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  return data.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
};

const callGemini = async ({ model, system, prompt, maxTokens, jsonMode, responseSchema }) => {
  const generationConfig = { maxOutputTokens: maxTokens };
  if (jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }
  if (responseSchema) {
    generationConfig.responseSchema = responseSchema;
  }

  const res = await fetch(`${GEMINI_URL(model)}?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: system }] },
      generationConfig,
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error("Gemini returned no candidates (the response may have been blocked by safety filters)");
  }
  return (candidate.content?.parts || []).map((p) => p.text || "").join("\n");
};

const callModel = async ({ system, prompt, maxTokens = 4000, requestedModel, jsonMode, responseSchema }) => {
  const { model, provider } = resolveModel(requestedModel);
  assertConfigured(provider);

  const text =
    provider === "anthropic"
      ? await callAnthropic({ model, system, prompt, maxTokens })
      : await callGemini({ model, system, prompt, maxTokens, jsonMode, responseSchema });

  return text;
};

const QUESTIONS_RESPONSE_SCHEMA = {
  type: "ARRAY",
  description: "List of parsed or generated questions",
  items: {
    type: "OBJECT",
    properties: {
      type: {
        type: "STRING",
        enum: [
          "mcq_single",
          "mcq_multiple",
          "short_text",
          "paragraph",
          "yes_no",
          "true_false",
          "rating_star",
          "rating_scale"
        ]
      },
      text: { type: "STRING" },
      options: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            text: { type: "STRING" }
          },
          required: ["text"]
        }
      },
      correctAnswerText: {
        type: "STRING",
        nullable: true
      }
    },
    required: ["type", "text"]
  }
};

const DUPLICATE_GROUPS_RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      questionIds: {
        type: "ARRAY",
        items: { type: "STRING" }
      },
      reason: { type: "STRING" }
    },
    required: ["questionIds", "reason"]
  }
};

const SUMMARIZE_RESPONSES_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    topThemes: {
      type: "ARRAY",
      items: { type: "STRING" }
    },
    notableQuote: { type: "STRING" }
  },
  required: ["summary", "topThemes", "notableQuote"]
};

const parseJSONResponse = (text) => {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
};

export const generateQuestions = async ({ paragraph, topic, count = 5, types = ["mcq_single"], model }) => {
  const source = paragraph
    ? `Base the questions on this paragraph:\n\n"""${paragraph}"""`
    : `Generate questions about this topic: "${topic}"`;

  const text = await callModel({
    requestedModel: model,
    jsonMode: true,
    responseSchema: QUESTIONS_RESPONSE_SCHEMA,
    system:
      "You generate quiz/form questions and respond with ONLY valid JSON matching the schema.",
    prompt: `${source}

Generate exactly ${count} questions using only these question types: ${types.join(", ")}.`,
  });

  return parseJSONResponse(text);
};

export const parsePastedQuestions = async (rawText, model) => {
  const text = await callModel({
    requestedModel: model,
    jsonMode: true,
    responseSchema: QUESTIONS_RESPONSE_SCHEMA,
    system:
      "You convert pasted questionnaire text into clean structured JSON. You handle surveys (no correct answer), quizzes (with correct answers), and all question formats.",
    prompt: `Parse the following pasted text into structured questions matching the requested schema. Identify each question's text, its type, its options (for choice questions), and whether a correct answer is marked. For surveys and opinion questions there is NO correct answer — set correctAnswerText to null.

"""${rawText}"""

Formatting rules:
- "type" must be one of: "mcq_single", "mcq_multiple", "short_text", "paragraph", "yes_no", "true_false", "rating_star", "rating_scale".
- "options" should only have "text" property. Empty array for non-choice types.
- "correctAnswerText" must be the exact text of correct option, or "true"/"false" / "yes"/"no", or null if no correct answer is indicated.`,
    maxTokens: 5000,
  });

  return parseJSONResponse(text);
};


export const fixGrammar = async (text, model) => {
  const result = await callModel({
    requestedModel: model,
    system: "You fix spelling and grammar only. Do not change meaning, tone, or add content. Return only the corrected text, nothing else.",
    prompt: text,
    maxTokens: 800,
  });
  return result.trim();
};

export const detectDuplicateQuestions = async (questions, model) => {
  const text = await callModel({
    requestedModel: model,
    jsonMode: true,
    responseSchema: DUPLICATE_GROUPS_RESPONSE_SCHEMA,
    system: "You detect near-duplicate or redundant questions in a form/quiz.",
    prompt: `Here are the questions in a form, as a JSON array of {id, text}:

${JSON.stringify(questions.map((q) => ({ id: q.id, text: q.text })), null, 2)}

Group any that are duplicates or near-duplicates of each other (asking essentially the same thing).`,
  });

  return parseJSONResponse(text);
};

export const summarizeResponses = async ({ questionText, answers, model }) => {
  const sample = answers.slice(0, 300); // cap prompt size for very large response sets

  const text = await callModel({
    requestedModel: model,
    jsonMode: true,
    responseSchema: SUMMARIZE_RESPONSES_RESPONSE_SCHEMA,
    system: "You summarize open-ended survey responses concisely for the form creator.",
    prompt: `Question: "${questionText}"

Here are ${sample.length} respondent answers:
${sample.map((a, i) => `${i + 1}. ${a}`).join("\n")}`,
    maxTokens: 600,
  });

  return parseJSONResponse(text);
};

export { AIDisabledError, AIConfigError };
