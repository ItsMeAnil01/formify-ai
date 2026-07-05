import { useState } from "react";
import api from "../api/axios";
import {
  QUESTION_TYPE_GROUPS,
  TYPES_WITH_OPTIONS,
  SINGLE_ANSWER_TYPES,
  MULTI_ANSWER_TYPES,
} from "../constants/questionTypes";

const randomId = () => Math.random().toString(36).slice(2, 9);

const QuestionEditor = ({ question, index, total, isGraded, onChange, onDelete, onMove, onDuplicate }) => {
  const [grammarLoading, setGrammarLoading] = useState(false);
  const update = (patch) => onChange({ ...question, ...patch });

  const updateOption = (optId, text) => {
    update({
      options: question.options.map((o) => (o.id === optId ? { ...o, text } : o)),
    });
  };

  const addOption = () => {
    const newOpt = { id: randomId(), text: "" };
    update({ options: [...(question.options || []), newOpt] });
  };

  const removeOption = (optId) => {
    const nextOptions = question.options.filter((o) => o.id !== optId);
    let correctAnswer = question.correctAnswer;
    if (Array.isArray(correctAnswer)) {
      correctAnswer = correctAnswer.filter((id) => id !== optId);
    } else if (correctAnswer === optId) {
      correctAnswer = null;
    }
    update({ options: nextOptions, correctAnswer });
  };

  const toggleMultiCorrect = (optId) => {
    const current = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
    const next = current.includes(optId)
      ? current.filter((id) => id !== optId)
      : [...current, optId];
    update({ correctAnswer: next });
  };

  const hasOptions = TYPES_WITH_OPTIONS.includes(question.type);
  const isSingleAnswer = SINGLE_ANSWER_TYPES.includes(question.type);
  const isMultiAnswer = MULTI_ANSWER_TYPES.includes(question.type);

  const fixGrammar = async () => {
    if (!question.text?.trim() || grammarLoading) return;
    setGrammarLoading(true);
    try {
      const { data } = await api.post("/ai/fix-grammar", { text: question.text });
      if (data.text) {
        update({ text: data.text });
      }
    } catch (err) {
      console.error("Failed to fix grammar:", err);
    } finally {
      setGrammarLoading(false);
    }
  };

  return (
    <div className="card group relative p-5">
      <div className="flex items-start gap-4">
        <span className="font-data mt-1 flex h-7 w-7 flex-none items-center justify-center rounded-md bg-ink/5 text-xs font-medium text-ink/50">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="flex-1 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 flex">
              <input
                className="input flex-1 !text-sm font-medium pr-10"
                placeholder="Question text"
                value={question.text}
                onChange={(e) => update({ text: e.target.value })}
              />
              {question.text?.trim() && (
                <button
                  type="button"
                  onClick={fixGrammar}
                  disabled={grammarLoading}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm hover:scale-110 active:scale-95 transition-transform"
                  title="Fix spelling & grammar with AI"
                >
                  {grammarLoading ? "⏳" : "✨"}
                </button>
              )}
            </div>
            <select
              className="input sm:w-56"
              value={question.type}
              onChange={(e) => update({ type: e.target.value, options: [], correctAnswer: null })}
            >
              {QUESTION_TYPE_GROUPS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.types.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <textarea
            className="input !py-2 text-xs"
            placeholder="Description or context (optional)"
            rows={1}
            value={question.description}
            onChange={(e) => update({ description: e.target.value })}
          />

          {hasOptions && (
            <div className="space-y-2 rounded-lg bg-paper/60 p-3">
              <div className="flex items-center justify-between !mb-1">
                <p className="label !mb-0">
                  Options {isGraded && <span className="text-ember">— tap to mark correct</span>}
                </p>
                {isGraded && question.correctAnswer != null && (
                  <button
                    onClick={() => update({ correctAnswer: null })}
                    className="text-xs text-ink/40 hover:text-ember underline"
                  >
                    Clear correct answer
                  </button>
                )}
              </div>
              {question.options.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2">
                  {isGraded &&
                    (isSingleAnswer ? (
                      <input
                        type="radio"
                        name={`correct-${question.id}`}
                        checked={question.correctAnswer === opt.id}
                        onChange={() => update({ correctAnswer: opt.id })}
                        className="h-4 w-4 accent-ember"
                      />
                    ) : isMultiAnswer ? (
                      <input
                        type="checkbox"
                        checked={Array.isArray(question.correctAnswer) && question.correctAnswer.includes(opt.id)}
                        onChange={() => toggleMultiCorrect(opt.id)}
                        className="h-4 w-4 accent-ember"
                      />
                    ) : null)}
                  <input
                    className="input flex-1 !py-2 text-sm"
                    placeholder="Option text"
                    value={opt.text}
                    onChange={(e) => updateOption(opt.id, e.target.value)}
                  />
                  <button
                    onClick={() => removeOption(opt.id)}
                    className="btn-ghost !px-2 !py-1 text-ink/40 hover:text-ember"
                    title="Remove option"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button onClick={addOption} className="text-xs font-semibold text-steel hover:text-steel-dark">
                + Add option
              </button>
            </div>
          )}

          {question.type === "yes_no" && isGraded && (
            <div className="rounded-lg bg-paper/60 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">Correct Answer</span>
                {question.correctAnswer != null && (
                  <button
                    onClick={() => update({ correctAnswer: null })}
                    className="text-xs text-ink/40 hover:text-ember underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={question.correctAnswer === "yes"}
                    onChange={() => update({ correctAnswer: "yes" })}
                    className="accent-ember"
                  />
                  Yes is correct
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={question.correctAnswer === "no"}
                    onChange={() => update({ correctAnswer: "no" })}
                    className="accent-ember"
                  />
                  No is correct
                </label>
              </div>
            </div>
          )}

          {question.type === "true_false" && isGraded && (
            <div className="rounded-lg bg-paper/60 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">Correct Answer</span>
                {question.correctAnswer != null && (
                  <button
                    onClick={() => update({ correctAnswer: null })}
                    className="text-xs text-ink/40 hover:text-ember underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={question.correctAnswer === "true"}
                    onChange={() => update({ correctAnswer: "true" })}
                    className="accent-ember"
                  />
                  True is correct
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={question.correctAnswer === "false"}
                    onChange={() => update({ correctAnswer: "false" })}
                    className="accent-ember"
                  />
                  False is correct
                </label>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs text-ink/60">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(e) => update({ required: e.target.checked })}
                className="accent-steel"
              />
              Required
            </label>

            {isGraded && (
              <>
                <label className="flex items-center gap-1.5">
                  Marks
                  <input
                    type="number"
                    className="input w-16 !py-1"
                    value={question.marks}
                    onChange={(e) => update({ marks: Number(e.target.value) })}
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  Negative
                  <input
                    type="number"
                    className="input w-16 !py-1"
                    value={question.negativeMarks}
                    onChange={(e) => update({ negativeMarks: Number(e.target.value) })}
                  />
                </label>
              </>
            )}

            {hasOptions && (
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={question.shuffleOptions}
                  onChange={(e) => update({ shuffleOptions: e.target.checked })}
                  className="accent-steel"
                />
                Shuffle options
              </label>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="btn-ghost !px-2 !py-1 disabled:opacity-20"
            title="Move up"
          >
            ↑
          </button>
          <button
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="btn-ghost !px-2 !py-1 disabled:opacity-20"
            title="Move down"
          >
            ↓
          </button>
          <button onClick={onDuplicate} className="btn-ghost !px-2 !py-1" title="Duplicate">
            ⧉
          </button>
          <button onClick={onDelete} className="btn-ghost !px-2 !py-1 text-ink/40 hover:text-ember" title="Delete">
            🗑
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionEditor;
