export const QUESTION_TYPE_GROUPS = [
  {
    group: "Text",
    types: [
      { value: "short_text", label: "Short answer" },
      { value: "paragraph", label: "Paragraph" },
    ],
  },
  {
    group: "Choice",
    types: [
      { value: "mcq_single", label: "Multiple choice (single select)" },
      { value: "mcq_multiple", label: "Multiple choice (multi select)" },
      { value: "dropdown", label: "Dropdown" },
    ],
  },
  {
    group: "Boolean",
    types: [
      { value: "yes_no", label: "Yes / No" },
      { value: "true_false", label: "True / False" },
    ],
  },
  {
    group: "Rating",
    types: [
      { value: "rating_star", label: "Star rating" },
      { value: "rating_scale", label: "Number scale (1–10)" },
      { value: "rating_emoji", label: "Emoji rating" },
    ],
  },
  {
    group: "Selection",
    types: [{ value: "checkbox", label: "Checkbox (multi-select)" }],
  },
  {
    group: "Input",
    types: [
      { value: "number", label: "Number" },
      { value: "email", label: "Email" },
      { value: "mobile", label: "Mobile" },
      { value: "date", label: "Date" },
      { value: "time", label: "Time" },
      { value: "url", label: "URL" },
    ],
  },
];

export const TYPES_WITH_OPTIONS = ["mcq_single", "mcq_multiple", "dropdown", "checkbox"];
export const SINGLE_ANSWER_TYPES = ["mcq_single", "dropdown", "yes_no", "true_false"];
export const MULTI_ANSWER_TYPES = ["mcq_multiple", "checkbox"];
export const RATING_TYPES = ["rating_star", "rating_scale", "rating_emoji"];

export const typeLabel = (value) => {
  for (const g of QUESTION_TYPE_GROUPS) {
    const found = g.types.find((t) => t.value === value);
    if (found) return found.label;
  }
  return value;
};

export const FORM_MODES = [
  { value: "custom", label: "Custom form" },
  { value: "survey", label: "Survey" },
  { value: "quiz", label: "Quiz" },
  { value: "feedback", label: "Feedback form" },
  { value: "registration", label: "Registration form" },
  { value: "application", label: "Application form" },
  { value: "exam", label: "Exam" },
];
