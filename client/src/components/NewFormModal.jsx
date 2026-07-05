import { useState, useRef, useCallback, useEffect } from "react";
import api from "../api/axios";
import { FORM_MODES, QUESTION_TYPE_GROUPS } from "../constants/questionTypes";
import { parsePastedText, validateParsed } from "../utils/pasteParser";
import { parseCSV, downloadCSVTemplate } from "../utils/csvParser";

const randomId = () => Math.random().toString(36).slice(2, 10);

/* ─── tiny helpers ───────────────────────────────────────────────── */
const typeLabel = (value) => {
  for (const g of QUESTION_TYPE_GROUPS) {
    const found = g.types.find((t) => t.value === value);
    if (found) return found.label;
  }
  return value;
};

const TABS = [
  { id: "blank",  icon: "✦", label: "Start blank" },
  { id: "paste",  icon: "📋", label: "Paste text"  },
  { id: "csv",    icon: "📄", label: "Import CSV"  },
];

/* ─── ParsedQuestionPreview ──────────────────────────────────────── */
const ParsedQuestionPreview = ({ questions, onChange }) => {
  if (!questions.length) return null;

  const updateQ = (i, patch) => {
    const next = [...questions];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const removeQ = (i) => onChange(questions.filter((_, j) => j !== i));

  return (
    <div className="mt-4 space-y-3 max-h-72 overflow-y-auto pr-1">
      {questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-md bg-ember/10 text-xs font-bold text-ember">
              {i + 1}
            </span>
            <div className="flex-1 space-y-2">
              <input
                className="w-full rounded-lg border border-ink/10 bg-paper px-3 py-2 text-sm font-medium text-ink outline-none focus:border-steel focus:ring-1 focus:ring-steel"
                value={q.text}
                onChange={(e) => updateQ(i, { text: e.target.value })}
                placeholder="Question text"
              />
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-steel/10 px-2.5 py-0.5 text-xs font-semibold text-steel">
                  {typeLabel(q.type)}
                </span>
                {q.options?.length > 0 && (
                  <span className="text-xs text-ink/40">{q.options.length} options</span>
                )}
              </div>
              {q.options?.length > 0 && (
                <ul className="space-y-1 pl-2">
                  {q.options.map((opt) => {
                    const isCorrect = q.correctAnswer != null && (
                      Array.isArray(q.correctAnswer)
                        ? q.correctAnswer.includes(opt.id)
                        : q.correctAnswer === opt.id
                    );
                    return (
                      <li key={opt.id} className="flex items-center gap-2 text-xs text-ink/60">
                        <span
                          className={`h-3 w-3 rounded-full border-2 flex-none ${
                            isCorrect ? "border-ember bg-ember" : "border-ink/20 bg-transparent"
                          }`}
                        />
                        <span className={isCorrect ? "font-medium text-ember" : ""}>{opt.text}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <button
              onClick={() => removeQ(i)}
              className="mt-0.5 rounded-md p-1 text-ink/30 transition-colors hover:bg-ember/10 hover:text-ember"
              title="Remove this question"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─── PasteTab ───────────────────────────────────────────────────── */
const PasteTab = ({ onParsed }) => {
  const [text, setText] = useState("");
  const [questions, setQuestions] = useState([]);
  const [status, setStatus] = useState(null); // { type: "info"|"error"|"success", msg }
  const [aiLoading, setAiLoading] = useState(false);

  const handleClientParse = () => {
    if (!text.trim()) {
      setStatus({ type: "error", msg: "Please paste some text first." });
      return;
    }
    const result = parsePastedText(text);
    const validation = validateParsed(result);
    if (!validation.valid) {
      setStatus({ type: "error", msg: validation.message });
      setQuestions([]);
      return;
    }
    setQuestions(result.questions);
    setStatus({ type: "success", msg: `✓ ${validation.message} — review below, then click Import` });
    onParsed({ questions: result.questions, suggestedTitle: result.title });
  };

  const handleAIParse = async () => {
    if (!text.trim()) {
      setStatus({ type: "error", msg: "Please paste some text first." });
      return;
    }
    setAiLoading(true);
    setStatus({ type: "info", msg: "AI is parsing your text…" });
    try {
      const { data } = await api.post("/ai/parse-paste", { text });
      if (!data.questions?.length) throw new Error("No questions detected in the pasted text");
      setQuestions(data.questions);
      setStatus({ type: "success", msg: `✓ AI detected ${data.questions.length} question${data.questions.length !== 1 ? "s" : ""} — review below` });
      onParsed({ questions: data.questions, suggestedTitle: null });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "AI parsing failed";
      // If it's a config error, explain what to do
      const hint = msg.toLowerCase().includes("not configured") || msg.toLowerCase().includes("api key")
        ? " (add ANTHROPIC_API_KEY or GEMINI_API_KEY to server/.env)"
        : "";
      setStatus({ type: "error", msg: msg + hint });
    } finally {
      setAiLoading(false);
    }
  };

  const handleQuestionsChange = (updated) => {
    setQuestions(updated);
    onParsed({ questions: updated, suggestedTitle: null });
  };

  return (
    <div className="space-y-4">
      {/* Format hint */}
      <div className="rounded-xl border border-steel/20 bg-steel/5 p-4 text-xs text-ink/60 leading-relaxed">
        <p className="font-semibold text-steel mb-1">💡 Accepted formats</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
          <span><code className="bg-steel/10 px-1 rounded">## 1. Question</code> markdown heading</span>
          <span><code className="bg-steel/10 px-1 rounded">1. Question</code> numbered list</span>
          <span><code className="bg-steel/10 px-1 rounded">() Option</code> choice (survey — no correct answer)</span>
          <span><code className="bg-steel/10 px-1 rounded">a) Option</code> lettered option</span>
          <span><code className="bg-steel/10 px-1 rounded">(X) Option</code> marks correct answer (quizzes only)</span>
          <span><code className="bg-steel/10 px-1 rounded">- Option</code> bullet option</span>
        </div>
        <p className="mt-2 text-ink/40">Survey questions with no marked correct answer are fully supported — just paste and go.</p>
      </div>

      <textarea
        className="w-full rounded-xl border border-ink/15 bg-white p-4 text-sm text-ink placeholder:text-ink/30 outline-none focus:border-steel focus:ring-1 focus:ring-steel resize-none font-mono leading-relaxed"
        rows={9}
        placeholder={`## 1. How comfortable are you being your true self with your partner?

() Not comfortable yet
() Mostly comfortable
() Completely comfortable
() Completely comfortable, even on bad days

---

## 2. When you think about your partner, your first feeling is:`}
        value={text}
        onChange={(e) => { setText(e.target.value); setQuestions([]); setStatus(null); }}
      />

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleClientParse}
          disabled={!text.trim()}
          className="btn-secondary flex-1 justify-center disabled:opacity-40"
        >
          ⚡ Parse instantly
        </button>
        <button
          onClick={handleAIParse}
          disabled={!text.trim() || aiLoading}
          className="btn-primary flex-1 justify-center disabled:opacity-40"
          title="Requires an AI API key in server/.env"
        >
          {aiLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Parsing…
            </span>
          ) : (
            "✨ Parse with AI (smarter)"
          )}
        </button>
      </div>

      {/* Status message */}
      {status && (
        <div
          className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
            status.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : status.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-blue-50 text-blue-700 border border-blue-200"
          }`}
        >
          {status.msg}
        </div>
      )}

      {/* Preview */}
      {questions.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            Preview — click ✕ to remove, or edit question text
          </p>
          <ParsedQuestionPreview questions={questions} onChange={handleQuestionsChange} />
        </>
      )}
    </div>
  );
};

/* ─── CSVTab ─────────────────────────────────────────────────────── */
const CSVTab = ({ onParsed }) => {
  const [questions, setQuestions] = useState([]);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = parseCSV(e.target.result);
      setErrors(result.errors);
      setWarnings(result.warnings);
      setQuestions(result.questions);
      onParsed({ questions: result.questions, suggestedTitle: null });
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.name.endsWith(".csv")) handleFile(file);
  };

  const handleQuestionsChange = (updated) => {
    setQuestions(updated);
    onParsed({ questions: updated, suggestedTitle: null });
  };

  return (
    <div className="space-y-4">
      {/* Template download */}
      <div className="flex items-center justify-between rounded-xl border border-steel/20 bg-steel/5 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">CSV format</p>
          <p className="text-xs text-ink/50">
            Columns: <code className="bg-steel/10 px-1 rounded">question, type, option1…6, correct_answer</code>
          </p>
        </div>
        <button
          onClick={() => downloadCSVTemplate()}
          className="btn-secondary !py-1.5 !text-xs whitespace-nowrap"
          title="Download a sample CSV you can fill in or use as a ChatGPT prompt"
        >
          ↓ Download template
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-ink/15 bg-paper/60 py-10 transition-colors hover:border-steel/40 hover:bg-steel/5"
      >
        <span className="text-3xl">📄</span>
        <div className="text-center">
          <p className="text-sm font-semibold text-ink group-hover:text-steel">
            {fileName ? fileName : "Drop CSV here or click to browse"}
          </p>
          <p className="mt-0.5 text-xs text-ink/40">.csv files only</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 space-y-1">
          {errors.map((e, i) => <p key={i}>⚠ {e}</p>)}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700 space-y-1">
          {warnings.map((w, i) => <p key={i}>ℹ {w}</p>)}
        </div>
      )}

      {/* Preview */}
      {questions.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            {questions.length} question{questions.length !== 1 ? "s" : ""} — review before importing
          </p>
          <ParsedQuestionPreview questions={questions} onChange={handleQuestionsChange} />
        </>
      )}
    </div>
  );
};

/* ─── BlankTab ───────────────────────────────────────────────────── */
const BlankTab = ({ selectedMode, onModeChange }) => (
  <div className="space-y-4">
    <p className="text-sm text-ink/60">Pick a form type to start building from scratch.</p>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {FORM_MODES.map((m) => (
        <button
          key={m.value}
          onClick={() => onModeChange(m.value)}
          className={`rounded-xl border-2 px-4 py-5 text-left transition-all hover:border-steel/40 hover:shadow-md ${
            selectedMode === m.value
              ? "border-ember bg-ember/5 shadow-md"
              : "border-ink/10 bg-white"
          }`}
        >
          <p className={`text-sm font-semibold ${selectedMode === m.value ? "text-ember" : "text-ink"}`}>
            {m.label}
          </p>
        </button>
      ))}
    </div>
  </div>
);

/* ─── NewFormModal ───────────────────────────────────────────────── */
const NewFormModal = ({ open, onClose, onCreated }) => {
  const [tab, setTab] = useState("blank");
  const [mode, setMode] = useState("custom");
  const [importedQuestions, setImportedQuestions] = useState([]);
  const [suggestedTitle, setSuggestedTitle] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleParsed = useCallback(({ questions, suggestedTitle: title }) => {
    setImportedQuestions(questions || []);
    if (title) setSuggestedTitle(title);
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      const title = suggestedTitle || (tab === "blank" ? "Untitled Form" : "Imported Form");

      // 1. Create the form
      const { data } = await api.post("/forms", { title, mode });
      const formId = data.form._id;

      // 2. If we have imported questions, save them immediately
      if (importedQuestions.length > 0) {
        await api.put(`/forms/${formId}`, {
          title,
          mode,
          questions: importedQuestions,
        });
      }

      onCreated(formId);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't create form");
    } finally {
      setCreating(false);
    }
  };

  const canCreate =
    tab === "blank" || importedQuestions.length > 0;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create a new form"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-2xl rounded-2xl bg-panel shadow-2xl border border-ink/10 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Create new form</h2>
              <p className="mt-0.5 text-xs text-ink/50">Start blank, paste questions, or upload a CSV</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-ink/10 px-6">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setImportedQuestions([]); setError(""); }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${
                  tab === t.id
                    ? "border-b-2 border-ember text-ink"
                    : "text-ink/40 hover:text-ink/70"
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {tab === "blank" && (
              <BlankTab selectedMode={mode} onModeChange={setMode} />
            )}
            {tab === "paste" && <PasteTab onParsed={handleParsed} />}
            {tab === "csv"   && <CSVTab   onParsed={handleParsed} />}
          </div>

          {/* Footer */}
          <div className="border-t border-ink/10 px-6 py-4">
            {/* Form mode picker for import tabs */}
            {tab !== "blank" && (
              <div className="mb-3 flex items-center gap-3">
                <label className="label !mb-0 whitespace-nowrap">Form type</label>
                <select
                  className="input flex-1"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                >
                  {FORM_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <p className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="btn-ghost">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={!canCreate || creating}
                className="btn-primary disabled:opacity-40 min-w-[140px] justify-center"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating…
                  </span>
                ) : tab === "blank" ? (
                  "Create form →"
                ) : importedQuestions.length > 0 ? (
                  `Import ${importedQuestions.length} question${importedQuestions.length !== 1 ? "s" : ""} →`
                ) : (
                  "Parse first"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NewFormModal;
