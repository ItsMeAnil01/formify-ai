import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import StatCard from "../components/StatCard";
import NewFormModal from "../components/NewFormModal";
import AdSenseWidget from "../components/AdSenseWidget";
import api from "../api/axios";

const STATUS_STYLES = {
  draft: "bg-ink/5 text-ink/60",
  published: "bg-success/10 text-success",
  closed: "bg-warn/10 text-warn",
  archived: "bg-ink/5 text-ink/40",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/forms");
      setForms(data.forms);
      setStats(data.stats);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load your forms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFormCreated = (formId) => {
    navigate(`/forms/${formId}/edit`);
  };

  const duplicate = async (id) => {
    await api.post(`/forms/${id}/duplicate`);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this form and all its responses? This can't be undone.")) return;
    await api.delete(`/forms/${id}`);
    load();
  };

  const copyLink = (slug) => {
    navigator.clipboard.writeText(`${window.location.origin}/f/${slug}`);
  };

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold">Your workspace</h1>
            <p className="mt-1 text-sm text-ink/60">Every form, quiz and exam you've built, in one place.</p>
          </div>
          <div className="flex gap-2">
            <button
              id="new-form-btn"
              onClick={() => setModalOpen(true)}
              className="btn-primary gap-2"
            >
              <span className="text-lg leading-none">+</span>
              New form
            </button>
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg bg-ember-light px-4 py-2 text-sm text-ember-dark">{error}</div>}

        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total forms" value={stats.totalForms} />
            <StatCard label="Active" value={stats.activeForms} accent />
            <StatCard label="Drafts" value={stats.draftForms} />
            <StatCard label="Responses" value={stats.totalResponses} />
            <StatCard label="Views" value={stats.totalViews} />
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="border-b border-ink/10 px-5 py-3">
            <h2 className="font-display text-sm font-semibold text-ink/70">All forms</h2>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-ink/50">Loading…</p>
          ) : forms.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-display text-lg font-medium text-ink/70">No forms yet</p>
              <p className="mt-1 text-sm text-ink/50">Pick a type above to build your first one.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/40">
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Mode</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Responses</th>
                  <th className="px-5 py-3 font-medium">Views</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {forms.map((f) => (
                  <tr key={f._id} className="border-b border-ink/5 last:border-0 hover:bg-paper/60">
                    <td className="px-5 py-3">
                      <button
                        onClick={() => navigate(`/forms/${f._id}/edit`)}
                        className="font-medium text-ink hover:text-steel"
                      >
                        {f.title}
                      </button>
                    </td>
                    <td className="px-5 py-3 capitalize text-ink/60">{f.mode}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[f.status]}`}>
                        {f.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-data text-ink/70">{f.responseCount}</td>
                    <td className="px-5 py-3 font-data text-ink/70">{f.views}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-3 text-xs font-semibold">
                        <button onClick={() => navigate(`/forms/${f._id}/responses`)} className="text-steel hover:text-steel-dark">
                          Responses
                        </button>
                        <button onClick={() => copyLink(f.slug)} className="text-ink/50 hover:text-ink">
                          Copy link
                        </button>
                        <button onClick={() => duplicate(f._id)} className="text-ink/50 hover:text-ink">
                          Duplicate
                        </button>
                        <button onClick={() => remove(f._id)} className="text-ember hover:text-ember-dark">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <AdSenseWidget slot="dashboard-bottom-ad" />
      </main>
      <NewFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleFormCreated}
      />
    </div>
  );
};

export default Dashboard;
