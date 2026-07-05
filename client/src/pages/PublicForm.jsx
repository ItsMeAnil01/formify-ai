import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";
import AdSenseWidget from "../components/AdSenseWidget";

const StarRating = ({ value, onChange }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        onClick={() => onChange(n)}
        className={`text-3xl transition-transform hover:scale-110 ${n <= value ? "text-ember" : "text-ink/15"}`}
      >
        ★
      </button>
    ))}
  </div>
);

const EmojiRating = ({ value, onChange }) => {
  const emojis = ["😞", "😕", "😐", "🙂", "😄"];
  return (
    <div className="flex gap-2">
      {emojis.map((e, i) => (
        <button
          key={e}
          type="button"
          onClick={() => onChange(i + 1)}
          className={`rounded-lg px-3 py-2 text-2xl transition-transform hover:scale-110 ${
            value === i + 1 ? "bg-ember-light" : ""
          }`}
        >
          {e}
        </button>
      ))}
    </div>
  );
};

const QuestionField = ({ question, value, onChange }) => {
  const opts = question.options || [];

  switch (question.type) {
    case "short_text":
      return (
        <input className="input" placeholder={question.placeholder || "Your answer"} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      );
    case "paragraph":
      return (
        <textarea className="input" rows={4} placeholder={question.placeholder || "Your answer"} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      );
    case "number":
      return <input type="number" className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    case "email":
      return <input type="email" className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    case "mobile":
      return <input type="tel" className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <input type="date" className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    case "time":
      return <input type="time" className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    case "url":
      return <input type="url" className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    case "dropdown":
      return (
        <select className="input" value={value || ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select an option</option>
          {opts.map((o) => (
            <option key={o.id} value={o.id}>
              {o.text}
            </option>
          ))}
        </select>
      );
    case "mcq_single":
      return (
        <div className="space-y-2">
          {opts.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-ink/10 px-4 py-2.5 hover:border-steel">
              <input type="radio" name={question.id} checked={value === o.id} onChange={() => onChange(o.id)} className="accent-steel" />
              <span className="text-sm">{o.text}</span>
            </label>
          ))}
        </div>
      );
    case "mcq_multiple":
    case "checkbox": {
      const arr = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {opts.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-ink/10 px-4 py-2.5 hover:border-steel">
              <input
                type="checkbox"
                checked={arr.includes(o.id)}
                onChange={() =>
                  onChange(arr.includes(o.id) ? arr.filter((id) => id !== o.id) : [...arr, o.id])
                }
                className="accent-steel"
              />
              <span className="text-sm">{o.text}</span>
            </label>
          ))}
        </div>
      );
    }
    case "yes_no":
      return (
        <div className="flex gap-3">
          {["yes", "no"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={`rounded-lg border px-6 py-2 text-sm font-medium capitalize ${
                value === v ? "border-ember bg-ember-light text-ember-dark" : "border-ink/10 text-ink/60"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      );
    case "true_false":
      return (
        <div className="flex gap-3">
          {["true", "false"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={`rounded-lg border px-6 py-2 text-sm font-medium capitalize ${
                value === v ? "border-ember bg-ember-light text-ember-dark" : "border-ink/10 text-ink/60"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      );
    case "rating_star":
      return <StarRating value={Number(value) || 0} onChange={onChange} />;
    case "rating_emoji":
      return <EmojiRating value={Number(value) || 0} onChange={onChange} />;
    case "rating_scale":
      return (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`font-data h-9 w-9 rounded-md border text-sm ${
                Number(value) === n ? "border-ember bg-ember text-white" : "border-ink/10 text-ink/60"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      );
    default:
      return <input className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  }
};

const PublicForm = () => {
  const { slug } = useParams();
  const [form, setForm] = useState(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [respondent, setRespondent] = useState({ name: "", email: "", mobile: "" });
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [startedAt] = useState(new Date().toISOString());

  const fetchForm = async (pwd) => {
    try {
      const { data } = await api.get(`/forms/public/${slug}`, { params: pwd ? { password: pwd } : {} });
      setForm(data.form);
      setNeedsPassword(false);
      setError("");
    } catch (err) {
      if (err.response?.status === 401 && err.response.data?.requiresPassword) {
        setNeedsPassword(true);
      } else {
        setError(err.response?.data?.message || "This form couldn't be loaded");
      }
    }
  };

  useEffect(() => {
    fetchForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const answeredCount = useMemo(() => Object.keys(answers).filter((k) => {
    const v = answers[k];
    return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  }).length, [answers]);

  const progress = form?.questions?.length ? Math.round((answeredCount / form.questions.length) * 100) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        respondentName: respondent.name,
        respondentEmail: respondent.email,
        respondentMobile: respondent.mobile,
        answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
        startedAt,
      };
      const { data } = await api.post(`/responses/${slug}`, payload);
      setResult(data.response);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't submit your response");
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blueprint bg-grid px-6">
        <div className="card max-w-sm p-8 text-center">
          <p className="font-display text-lg font-semibold text-ink">Can't open this form</p>
          <p className="mt-2 text-sm text-ink/60">{error}</p>
        </div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blueprint bg-grid px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchForm(password);
          }}
          className="card w-full max-w-sm space-y-4 p-6"
        >
          <p className="font-display text-lg font-semibold">Password required</p>
          <input type="password" className="input" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-ember">{error}</p>}
          <button className="btn-primary w-full">Continue</button>
        </form>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <p className="text-sm text-ink/50">Loading…</p>
      </div>
    );
  }

  if (result) {
    const isGraded = result.score !== undefined;
    return (
      <div className="flex min-h-screen items-center justify-center bg-blueprint bg-grid px-6">
        <div className="card w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-2xl text-success">✓</div>
          <h1 className="font-display text-xl font-semibold">Response submitted</h1>
          {isGraded ? (
            <>
              <p className="font-data mt-3 text-3xl font-medium text-ink">
                {result.score} / {result.maxScore}
              </p>
              <p className={`mt-1 text-sm font-semibold ${result.passed ? "text-success" : "text-ember"}`}>
                {result.passed ? "Passed" : "Not passed"}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink/60">Thanks — your answers have been recorded.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blueprint bg-grid">
      <div className="sticky top-0 z-10 h-1 w-full bg-ink/5">
        <div className="h-1 bg-ember transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="card mb-6 p-6">
          <h1 className="font-display text-2xl font-semibold">{form.title}</h1>
          {form.description && <p className="mt-2 text-sm text-ink/60">{form.description}</p>}
          {form.settings.timeLimitMinutes && (
            <p className="mt-3 text-xs font-semibold text-ember">⏱ Time limit: {form.settings.timeLimitMinutes} minutes</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {(form.settings.collectName !== "hidden" ||
            form.settings.collectEmail !== "hidden" ||
            form.settings.collectMobile !== "hidden") && (
            <div className="card space-y-3 p-5">
              {form.settings.collectName !== "hidden" && (
                <div>
                  <label className="label">
                    Name {form.settings.collectName === "required" && <span className="text-ember">*</span>}
                  </label>
                  <input
                    className="input"
                    required={form.settings.collectName === "required"}
                    value={respondent.name}
                    onChange={(e) => setRespondent((r) => ({ ...r, name: e.target.value }))}
                  />
                </div>
              )}
              {form.settings.collectEmail !== "hidden" && (
                <div>
                  <label className="label">
                    Email {form.settings.collectEmail === "required" && <span className="text-ember">*</span>}
                  </label>
                  <input
                    type="email"
                    className="input"
                    required={form.settings.collectEmail === "required"}
                    value={respondent.email}
                    onChange={(e) => setRespondent((r) => ({ ...r, email: e.target.value }))}
                  />
                </div>
              )}
              {form.settings.collectMobile !== "hidden" && (
                <div>
                  <label className="label">
                    Mobile {form.settings.collectMobile === "required" && <span className="text-ember">*</span>}
                  </label>
                  <input
                    type="tel"
                    className="input"
                    required={form.settings.collectMobile === "required"}
                    value={respondent.mobile}
                    onChange={(e) => setRespondent((r) => ({ ...r, mobile: e.target.value }))}
                  />
                </div>
              )}
            </div>
          )}

          {form.questions.map((q, i) => (
            <div key={q.id} className="card p-5">
              <p className="mb-1 text-sm font-medium text-ink">
                <span className="font-data text-ink/30">{String(i + 1).padStart(2, "0")}</span> {q.text}
                {q.required && <span className="text-ember"> *</span>}
              </p>
              {q.description && <p className="mb-3 text-xs text-ink/50">{q.description}</p>}
              <div className="mt-2">
                <QuestionField
                  question={q}
                  value={answers[q.id]}
                  onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                />
              </div>
            </div>
          ))}

          {error && <div className="rounded-lg bg-ember-light px-4 py-2 text-sm text-ember-dark">{error}</div>}

          <button disabled={submitting} className="btn-primary w-full !py-3">
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </form>

        <AdSenseWidget slot="public-form-bottom-ad" />
      </div>
    </div>
  );
};

export default PublicForm;
