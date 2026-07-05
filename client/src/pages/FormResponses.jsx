import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import StatCard from "../components/StatCard";
import api from "../api/axios";

const FormResponses = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState({});

  const loadSummary = async (questionId) => {
    setSummaries((prev) => ({
      ...prev,
      [questionId]: { loading: true, data: null, error: "" },
    }));

    try {
      const { data } = await api.get(`/ai/forms/${id}/questions/${questionId}/summary`);
      setSummaries((prev) => ({
        ...prev,
        [questionId]: { loading: false, data: data.summary, error: "" },
      }));
    } catch (err) {
      setSummaries((prev) => ({
        ...prev,
        [questionId]: {
          loading: false,
          data: null,
          error: err.response?.data?.message || "Failed to load summary",
        },
      }));
    }
  };

  useEffect(() => {
    (async () => {
      const [formRes, respRes, analyticsRes] = await Promise.all([
        api.get(`/forms/${id}`),
        api.get(`/forms/${id}/responses`),
        api.get(`/forms/${id}/analytics`),
      ]);
      setForm(formRes.data.form);
      setResponses(respRes.data.responses);
      setAnalytics(analyticsRes.data.analytics);
      setLoading(false);
    })();
  }, [id]);

  const downloadCsv = async () => {
    const res = await api.get(`/forms/${id}/export.csv`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.title.replace(/\s+/g, "_")}_responses.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading || !form) {
    return (
      <div className="min-h-screen bg-paper">
        <Navbar />
        <p className="p-8 text-sm text-ink/50">Loading responses…</p>
      </div>
    );
  }

  const isGraded = form.mode === "quiz" || form.mode === "exam" || form.settings.autoGrade;

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <button onClick={() => navigate("/dashboard")} className="mb-4 text-sm font-semibold text-ink/50 hover:text-ink">
          ← Back to dashboard
        </button>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">{form.title}</h1>
            <p className="text-sm text-ink/50">Responses & analytics</p>
          </div>
          <button onClick={downloadCsv} className="btn-secondary">
            ⬇ Export CSV
          </button>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total responses" value={analytics.totalResponses} />
          <StatCard label="Views" value={analytics.totalViews} />
          <StatCard
            label="Completion rate"
            value={analytics.completionRate ?? "—"}
            suffix={analytics.completionRate !== null ? "%" : ""}
          />
          <StatCard label="Avg. time" value={analytics.avgCompletionTimeSec} suffix="s" />
          {isGraded && <StatCard label="Avg. score" value={analytics.averageScore ?? "—"} accent />}
        </div>

        {isGraded && analytics.totalResponses > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Highest score" value={analytics.highestScore} />
            <StatCard label="Lowest score" value={analytics.lowestScore} />
            <StatCard label="Pass %" value={analytics.passPercent} suffix="%" accent />
            <StatCard label="Fail %" value={analytics.failPercent} suffix="%" />
          </div>
        )}

        <div className="card mb-8 overflow-hidden">
          <div className="border-b border-ink/10 px-5 py-3">
            <h2 className="font-display text-sm font-semibold text-ink/70">Question breakdown</h2>
          </div>
          <div className="divide-y divide-ink/5">
            {analytics.questionBreakdown.map((q) => (
              <div key={q.questionId} className="p-4">
                <p className="text-sm font-medium text-ink">{q.text}</p>
                <p className="mb-2 text-xs text-ink/40">{q.responseCount} responses</p>
                {q.optionCounts && (
                  <div className="space-y-1.5">
                    {Object.entries(q.optionCounts).map(([opt, count]) => {
                      const pct = q.responseCount ? Math.round((count / q.responseCount) * 100) : 0;
                      return (
                        <div key={opt} className="flex items-center gap-3 text-xs">
                          <span className="w-24 truncate text-ink/60">{opt}</span>
                          <div className="h-2 flex-1 rounded-full bg-ink/5">
                            <div className="h-2 rounded-full bg-steel" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-data w-10 text-right text-ink/50">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {q.average !== undefined && q.average !== null && (
                  <p className="font-data text-sm text-ink/70">Average: {q.average}</p>
                )}
                {q.correctPercent !== undefined && q.correctPercent !== null && (
                  <p className="font-data text-sm text-success">{q.correctPercent}% answered correctly</p>
                )}
                 {["short_text", "paragraph"].includes(q.type) && q.responseCount > 0 && (
                  <div className="mt-2 text-xs">
                    {!summaries[q.questionId] && (
                      <button
                        onClick={() => loadSummary(q.questionId)}
                        className="btn-secondary !py-1 !text-[11px] flex items-center gap-1 bg-steel/5 hover:bg-steel/15 text-steel border-steel/20"
                      >
                        ✨ Summarize responses with AI
                      </button>
                    )}

                    {summaries[q.questionId] && (
                      <div className="mt-2 space-y-2 rounded-xl bg-steel/5 border border-steel/10 p-3.5">
                        <div className="flex items-center justify-between border-b border-steel/10 pb-1.5 mb-2">
                          <p className="font-semibold text-steel flex items-center gap-1.5">
                            ✨ AI Sentiment & Response Summary
                          </p>
                          <button
                            onClick={() => loadSummary(q.questionId)}
                            className="text-[10px] text-ink/40 hover:text-ink hover:underline"
                          >
                            🔄 Refresh
                          </button>
                        </div>

                        {summaries[q.questionId].loading && (
                          <div className="flex items-center gap-2 text-ink/40 py-1">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-steel border-t-transparent" />
                            AI is reading responses…
                          </div>
                        )}

                        {summaries[q.questionId].error && (
                          <p className="text-ember-dark font-medium py-1">{summaries[q.questionId].error}</p>
                        )}

                        {summaries[q.questionId].data && (
                          <div className="space-y-3 text-ink/75 leading-relaxed">
                            <p className="text-xs">{summaries[q.questionId].data.summary}</p>
                            
                            {summaries[q.questionId].data.topThemes?.length > 0 && (
                              <div>
                                <p className="font-semibold text-[11px] text-ink/50 uppercase tracking-wide mb-1">Key Themes</p>
                                <ul className="list-disc pl-4 space-y-0.5 text-xs text-ink/70">
                                  {summaries[q.questionId].data.topThemes.map((t, idx) => (
                                    <li key={idx}>{t}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {summaries[q.questionId].data.notableQuote && (
                              <div className="border-l-2 border-ember pl-2.5 py-0.5 italic text-ink/60 bg-ember/3 rounded-r-lg">
                                "{summaries[q.questionId].data.notableQuote}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                 )}
               </div>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-ink/10 px-5 py-3">
            <h2 className="font-display text-sm font-semibold text-ink/70">All responses</h2>
          </div>
          {responses.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink/50">No responses yet — share your form link to start collecting.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/40">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Submitted</th>
                    <th className="px-5 py-3 font-medium">Time</th>
                    {isGraded && <th className="px-5 py-3 font-medium">Score</th>}
                    {isGraded && <th className="px-5 py-3 font-medium">Result</th>}
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r) => (
                    <tr key={r._id} className="border-b border-ink/5 last:border-0">
                      <td className="px-5 py-3">{r.respondentName || "—"}</td>
                      <td className="px-5 py-3 text-ink/60">{r.respondentEmail || "—"}</td>
                      <td className="px-5 py-3 text-ink/60">{new Date(r.submittedAt).toLocaleString()}</td>
                      <td className="font-data px-5 py-3 text-ink/60">{r.completionTimeSec}s</td>
                      {isGraded && (
                        <td className="font-data px-5 py-3">
                          {r.score}/{r.maxScore}
                        </td>
                      )}
                      {isGraded && (
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold ${r.passed ? "text-success" : "text-ember"}`}>
                            {r.passed ? "Passed" : "Failed"}
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FormResponses;
