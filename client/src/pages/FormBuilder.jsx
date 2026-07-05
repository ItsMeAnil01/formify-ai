import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import QuestionEditor from "../components/QuestionEditor";
import api from "../api/axios";
import { FORM_MODES } from "../constants/questionTypes";
import { parsePastedText, validateParsed } from "../utils/pasteParser";
import { parseCSV, downloadCSVTemplate } from "../utils/csvParser";

const randomId = () => Math.random().toString(36).slice(2, 10);

const blankQuestion = () => ({
  id: randomId(),
  type: "short_text",
  text: "",
  description: "",
  options: [],
  correctAnswer: null,
  marks: 1,
  negativeMarks: 0,
  required: true,
  hint: "",
  explanation: "",
  shuffleOptions: false,
});

const FormBuilder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("questions");

  // Import panel state
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState("paste"); // "paste" | "csv" | "ai"
  const [pasteText, setPasteText] = useState("");
  const [importQuestions, setImportQuestions] = useState([]);
  const [importStatus, setImportStatus] = useState(null);
  const [aiImporting, setAiImporting] = useState(false);
  const csvInputRef = useRef();

  // AI Generator state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiTypes, setAiTypes] = useState(["mcq_single"]);
  const [aiGenerating, setAiGenerating] = useState(false);

  useEffect(() => {
    api.get(`/forms/${id}`).then(({ data }) => setForm(data.form));
  }, [id]);

  const patchForm = (patch) => setForm((f) => ({ ...f, ...patch }));
  const patchSettings = (patch) => setForm((f) => ({ ...f, settings: { ...f.settings, ...patch } }));

  const save = useCallback(async () => {
    if (!form) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await api.put(`/forms/${form._id}`, {
        title: form.title,
        description: form.description,
        category: form.category,
        mode: form.mode,
        visibility: form.visibility,
        questions: form.questions,
        settings: form.settings,
        ...(form.accessPassword ? { accessPassword: form.accessPassword } : {}),
      });
      setForm(data.form);
      setSavedAt(new Date());
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save changes");
    } finally {
      setSaving(false);
    }
  }, [form]);

  const setStatus = async (status) => {
    const { data } = await api.patch(`/forms/${form._id}/status`, { status });
    setForm(data.form);
  };

  if (!form) {
    return (
      <div className="min-h-screen bg-paper">
        <Navbar />
        <p className="p-8 text-sm text-ink/50">Loading form…</p>
      </div>
    );
  }

  const isGraded = form.mode === "quiz" || form.mode === "exam" || form.settings.autoGrade;
  const shareUrl = `${window.location.origin}/f/${form.slug}`;

  const addQuestion = () => patchForm({ questions: [...form.questions, blankQuestion()] });
  const updateQuestion = (index, updated) => {
    const next = [...form.questions];
    next[index] = updated;
    patchForm({ questions: next });
  };
  const deleteQuestion = (index) => patchForm({ questions: form.questions.filter((_, i) => i !== index) });
  const duplicateQuestion = (index) => {
    const clone = { ...form.questions[index], id: randomId() };
    const next = [...form.questions];
    next.splice(index + 1, 0, clone);
    patchForm({ questions: next });
  };
  const moveQuestion = (index, dir) => {
    const next = [...form.questions];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patchForm({ questions: next });
  };

  // ── Import helpers ──────────────────────────────────────────────
  const handleClientImport = () => {
    if (!pasteText.trim()) return;
    const result = parsePastedText(pasteText);
    const v = validateParsed(result);
    if (!v.valid) { setImportStatus({ type: "error", msg: v.message }); return; }
    setImportQuestions(result.questions);
    setImportStatus({ type: "success", msg: `✓ ${v.message} ready to append` });
  };

  const handleAIImport = async () => {
    if (!pasteText.trim()) return;
    setAiImporting(true);
    setImportStatus({ type: "info", msg: "AI parsing…" });
    try {
      const { data } = await api.post("/ai/parse-paste", { text: pasteText });
      setImportQuestions(data.questions || []);
      setImportStatus({ type: "success", msg: `✓ ${data.questions?.length || 0} questions ready` });
    } catch (err) {
      setImportStatus({ type: "error", msg: err.response?.data?.message || "AI parse failed" });
    } finally {
      setAiImporting(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setImportStatus({ type: "info", msg: "AI is generating questions…" });
    try {
      const { data } = await api.post("/ai/generate-questions", {
        topic: aiPrompt,
        count: Number(aiCount),
        types: aiTypes,
      });
      setImportQuestions(data.questions || []);
      setImportStatus({ type: "success", msg: `✓ AI generated ${data.questions?.length || 0} questions` });
    } catch (err) {
      setImportStatus({ type: "error", msg: err.response?.data?.message || "AI generation failed" });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCSVFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = parseCSV(e.target.result);
      setImportQuestions(result.questions);
      if (result.errors.length) setImportStatus({ type: "error", msg: result.errors[0] });
      else setImportStatus({ type: "success", msg: `✓ ${result.questions.length} questions from CSV` });
    };
    reader.readAsText(file);
  };

  const commitImport = () => {
    if (!importQuestions.length) return;
    patchForm({ questions: [...form.questions, ...importQuestions] });
    setImportQuestions([]);
    setPasteText("");
    setImportStatus(null);
    setImportOpen(false);
  };

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-sm font-semibold text-ink/50 hover:text-ink">
            ← Back to dashboard
          </button>
          <div className="flex items-center gap-3">
            {savedAt && <span className="text-xs text-ink/40">Saved {savedAt.toLocaleTimeString()}</span>}
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                form.status === "published" ? "bg-success/10 text-success" : "bg-ink/5 text-ink/60"
              }`}
            >
              {form.status}
            </span>
            <a
              href={`/f/${form.slug}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary flex items-center gap-1.5"
            >
              👁️ Preview
            </a>
            <button onClick={save} disabled={saving} className="btn-secondary">
              {saving ? "Saving…" : "Save"}
            </button>
            {form.status === "published" ? (
              <button onClick={() => setStatus("closed")} className="btn-ghost text-warn">
                Close form
              </button>
            ) : (
              <button
                onClick={async () => {
                  await save();
                  setStatus("published");
                }}
                className="btn-primary"
              >
                Publish
              </button>
            )}
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg bg-ember-light px-4 py-2 text-sm text-ember-dark">{error}</div>}

        {form.status === "published" && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-steel/20 bg-steel-light px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-steel-dark">Share link</p>
              <p className="font-data text-sm text-ink">{shareUrl}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(shareUrl)}
                className="btn-secondary !py-1.5 !text-xs"
              >
                Copy
              </button>
              <a href={`/f/${form.slug}`} target="_blank" rel="noreferrer" className="btn-secondary !py-1.5 !text-xs">
                Open
              </a>
            </div>
          </div>
        )}

        <div className="card mb-6 space-y-4 p-5">
          <input
            className="font-display w-full border-none bg-transparent p-0 text-xl font-semibold outline-none placeholder:text-ink/30"
            placeholder="Form title"
            value={form.title}
            onChange={(e) => patchForm({ title: e.target.value })}
          />
          <textarea
            className="w-full resize-none border-none bg-transparent p-0 text-sm text-ink/60 outline-none placeholder:text-ink/30"
            placeholder="Add a description so respondents know what this is about…"
            rows={2}
            value={form.description}
            onChange={(e) => patchForm({ description: e.target.value })}
          />
          <div className="flex flex-wrap gap-3 border-t border-ink/10 pt-4">
            <select className="input w-48" value={form.mode} onChange={(e) => patchForm({ mode: e.target.value })}>
              {FORM_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              className="input w-48"
              value={form.visibility}
              onChange={(e) => patchForm({ visibility: e.target.value })}
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted (link only)</option>
              <option value="password">Password protected</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>

        <div className="mb-4 flex gap-1 border-b border-ink/10">
          {["questions", "settings"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold capitalize ${
                tab === t ? "border-b-2 border-ember text-ink" : "text-ink/40 hover:text-ink/70"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "questions" ? (
          <div className="space-y-4">
            {form.questions.length === 0 && !importOpen && (
              <div className="card p-10 text-center text-sm text-ink/50">
                No questions yet. Add your first one below.
              </div>
            )}
            {form.questions.map((q, i) => (
              <QuestionEditor
                key={q.id}
                question={q}
                index={i}
                total={form.questions.length}
                isGraded={isGraded}
                onChange={(updated) => updateQuestion(i, updated)}
                onDelete={() => deleteQuestion(i)}
                onDuplicate={() => duplicateQuestion(i)}
                onMove={(dir) => moveQuestion(i, dir)}
              />
            ))}

            {/* ── Import questions panel ── */}
            {importOpen && (
              <div className="card overflow-hidden border-steel/30">
                <div className="flex items-center justify-between border-b border-ink/10 bg-steel/5 px-5 py-3">
                  <p className="font-display text-sm font-semibold text-steel">Import questions</p>
                  <button
                    onClick={() => { setImportOpen(false); setImportQuestions([]); setImportStatus(null); }}
                    className="text-xs text-ink/40 hover:text-ink"
                  >✕ Close</button>
                </div>

                {/* import sub-tabs */}
                <div className="flex border-b border-ink/10 px-5">
                  {["paste", "csv", "ai"].map((t) => (
                    <button
                      key={t}
                      onClick={() => { setImportTab(t); setImportQuestions([]); setImportStatus(null); }}
                      className={`px-4 py-2.5 text-sm font-semibold capitalize ${
                        importTab === t ? "border-b-2 border-ember text-ink" : "text-ink/40 hover:text-ink/70"
                      }`}
                    >
                      {t === "paste" ? "📋 Paste text" : t === "csv" ? "📄 CSV file" : "✨ Generate with AI"}
                    </button>
                  ))}
                </div>

                <div className="space-y-4 p-5">
                  {importTab === "paste" ? (
                    <>
                      <textarea
                        className="w-full rounded-xl border border-ink/15 bg-white p-4 text-sm font-mono text-ink placeholder:text-ink/30 outline-none focus:border-steel focus:ring-1 focus:ring-steel resize-none"
                        rows={7}
                        placeholder={"## 1. Question text\n() Option A\n() Option B\n\n## 2. Another question…"}
                        value={pasteText}
                        onChange={(e) => { setPasteText(e.target.value); setImportQuestions([]); setImportStatus(null); }}
                      />
                      <div className="flex gap-2">
                        <button onClick={handleClientImport} disabled={!pasteText.trim()} className="btn-secondary flex-1 justify-center disabled:opacity-40">
                          ⚡ Parse instantly
                        </button>
                        <button onClick={handleAIImport} disabled={!pasteText.trim() || aiImporting} className="btn-primary flex-1 justify-center disabled:opacity-40">
                          {aiImporting ? "Parsing…" : "✨ AI parse"}
                        </button>
                      </div>
                    </>
                  ) : importTab === "csv" ? (
                    <>
                      <div className="flex items-center justify-between rounded-xl border border-steel/20 bg-steel/5 px-4 py-3">
                        <p className="text-xs text-ink/50"><code>question, type, option1…6, correct_answer</code></p>
                        <button onClick={() => downloadCSVTemplate()} className="btn-secondary !py-1.5 !text-xs">↓ Template</button>
                      </div>
                      <div
                        onClick={() => csvInputRef.current?.click()}
                        onDrop={(e) => { e.preventDefault(); handleCSVFile(e.dataTransfer.files?.[0]); }}
                        onDragOver={(e) => e.preventDefault()}
                        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink/15 bg-paper/60 py-8 hover:border-steel/40 hover:bg-steel/5 transition-colors"
                      >
                        <span className="text-2xl">📄</span>
                        <p className="text-sm text-ink/60">Drop CSV here or click to browse</p>
                        <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleCSVFile(e.target.files?.[0])} />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="label">What topic or description would you like questions about?</label>
                        <textarea
                          className="w-full rounded-xl border border-ink/15 bg-white p-3 text-sm text-ink placeholder:text-ink/30 outline-none focus:border-steel focus:ring-1 focus:ring-steel resize-none"
                          rows={3}
                          placeholder="e.g. JavaScript Promises for beginners, or customer feedback on product delivery speed"
                          value={aiPrompt}
                          onChange={(e) => { setAiPrompt(e.target.value); setImportQuestions([]); setImportStatus(null); }}
                        />
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="label">Number of questions</label>
                          <select
                            className="input !py-2"
                            value={aiCount}
                            onChange={(e) => setAiCount(Number(e.target.value))}
                          >
                            {[3, 5, 8, 10, 15].map((n) => (
                              <option key={n} value={n}>{n} questions</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex-1">
                          <label className="label">Question format</label>
                          <select
                            className="input !py-2"
                            value={aiTypes[0]}
                            onChange={(e) => setAiTypes([e.target.value])}
                          >
                            <option value="mcq_single">Multiple Choice (Single Select)</option>
                            <option value="mcq_multiple">Multiple Choice (Multi Select)</option>
                            <option value="yes_no">Yes / No</option>
                            <option value="true_false">True / False</option>
                            <option value="short_text">Short Answer</option>
                            <option value="paragraph">Paragraph</option>
                          </select>
                        </div>
                      </div>

                      <button
                        onClick={handleAIGenerate}
                        disabled={!aiPrompt.trim() || aiGenerating}
                        className="btn-primary w-full justify-center disabled:opacity-40"
                      >
                        {aiGenerating ? "Generating questions…" : "✨ Generate questions"}
                      </button>
                    </div>
                  )}

                  {importStatus && (
                    <div className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
                      importStatus.type === "error" ? "bg-red-50 text-red-700 border border-red-200"
                      : importStatus.type === "success" ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-blue-50 text-blue-700 border border-blue-200"
                    }`}>
                      {importStatus.msg}
                    </div>
                  )}

                  {importQuestions.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {importQuestions.map((q, i) => (
                        <div key={q.id} className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white px-4 py-2 text-sm">
                          <span className="flex h-5 w-5 flex-none items-center justify-center rounded bg-ember/10 text-xs font-bold text-ember">{i + 1}</span>
                          <span className="flex-1 truncate">{q.text}</span>
                          <span className="rounded-full bg-steel/10 px-2 py-0.5 text-xs text-steel">{q.type}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {importQuestions.length > 0 && (
                    <button onClick={commitImport} className="btn-primary w-full justify-center">
                      + Append {importQuestions.length} question{importQuestions.length !== 1 ? "s" : ""} to form
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={addQuestion} className="btn-secondary flex-1 justify-center border-dashed">
                + Add question
              </button>
              <button
                onClick={() => { setImportOpen((v) => !v); setImportQuestions([]); setImportStatus(null); }}
                className={`btn-secondary gap-1.5 ${importOpen ? "border-steel text-steel" : ""}`}
                title="Import questions from text or CSV"
              >
                ⬆ Import
              </button>
            </div>
          </div>
        ) : (
          <div className="card space-y-6 p-6">
            <section>
              <h3 className="font-display mb-3 text-sm font-semibold text-ink/70">Respondent details</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {["collectName", "collectEmail", "collectMobile"].map((field) => (
                  <div key={field}>
                    <label className="label">{field.replace("collect", "")}</label>
                    <select
                      className="input"
                      value={form.settings[field]}
                      onChange={(e) => patchSettings({ [field]: e.target.value })}
                    >
                      <option value="required">Required</option>
                      <option value="optional">Optional</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-ink/10 pt-5">
              <h3 className="font-display mb-3 text-sm font-semibold text-ink/70">Response limits</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Allow</label>
                  <select
                    className="input"
                    value={form.settings.responseLimitMode}
                    onChange={(e) => patchSettings({ responseLimitMode: e.target.value })}
                  >
                    <option value="multiple">Multiple responses</option>
                    <option value="one_per_email">One response per email</option>
                    <option value="one_per_device">One response per device</option>
                  </select>
                </div>
                <div>
                  <label className="label">Max responses (optional)</label>
                  <input
                    type="number"
                    className="input"
                    value={form.settings.maxResponses || ""}
                    onChange={(e) => patchSettings({ maxResponses: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
              </div>
            </section>

            <section className="border-t border-ink/10 pt-5">
              <h3 className="font-display mb-3 text-sm font-semibold text-ink/70">Grading & results</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-ember"
                    checked={form.settings.autoGrade}
                    onChange={(e) => patchSettings({ autoGrade: e.target.checked })}
                  />
                  Auto-evaluate answers (marks & pass/fail)
                </label>
                {isGraded && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="label">Pass marks</label>
                      <input
                        type="number"
                        className="input"
                        value={form.settings.passMarks}
                        onChange={(e) => patchSettings({ passMarks: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="label">Time limit (min)</label>
                      <input
                        type="number"
                        className="input"
                        value={form.settings.timeLimitMinutes || ""}
                        onChange={(e) =>
                          patchSettings({ timeLimitMinutes: e.target.value ? Number(e.target.value) : null })
                        }
                      />
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="accent-ember"
                      checked={form.settings.randomQuestions}
                      onChange={(e) => patchSettings({ randomQuestions: e.target.checked })}
                    />
                    Shuffle question order
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="accent-ember"
                      checked={form.settings.instantResult}
                      onChange={(e) => patchSettings({ instantResult: e.target.checked })}
                    />
                    Show result instantly
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="accent-ember"
                      checked={form.settings.showCorrectAnswers}
                      onChange={(e) => patchSettings({ showCorrectAnswers: e.target.checked })}
                    />
                    Reveal correct answers after submit
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="accent-ember"
                      checked={form.settings.showExplanation}
                      onChange={(e) => patchSettings({ showExplanation: e.target.checked })}
                    />
                    Show explanations
                  </label>
                </div>
              </div>
            </section>

            <section className="border-t border-ink/10 pt-5">
              <h3 className="font-display mb-3 text-sm font-semibold text-ink/70">Schedule</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Opens</label>
                  <input
                    type="datetime-local"
                    className="input"
                    onChange={(e) => patchSettings({ startDate: e.target.value || null })}
                  />
                </div>
                <div>
                  <label className="label">Closes</label>
                  <input
                    type="datetime-local"
                    className="input"
                    onChange={(e) => patchSettings({ endDate: e.target.value || null })}
                  />
                </div>
              </div>
            </section>

            {form.visibility === "password" && (
              <section className="border-t border-ink/10 pt-5">
                <h3 className="font-display mb-3 text-sm font-semibold text-ink/70">Access password</h3>
                <input
                  type="text"
                  className="input max-w-xs"
                  placeholder="Set a password respondents must enter"
                  onChange={(e) => patchForm({ accessPassword: e.target.value })}
                />
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default FormBuilder;
