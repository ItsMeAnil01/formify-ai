import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const { login, loginWithGoogle, loading, error } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await login(email, password);
    if (ok) navigate("/dashboard");
  };

  const handleGoogleCallback = async (response) => {
    const ok = await loginWithGoogle(response.credential);
    if (ok) navigate("/dashboard");
  };

  useEffect(() => {
    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
        });
        const btnContainer = document.getElementById("google-signin-btn");
        if (btnContainer) {
          window.google.accounts.id.renderButton(btnContainer, {
            theme: "outline",
            size: "large",
            width: btnContainer.offsetWidth || 382,
            text: "signin_with",
          });
        }
      }
    };

    initGoogle();
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        initGoogle();
        clearInterval(timer);
      }
    }, 300);
    return () => clearInterval(timer);
  }, [loginWithGoogle, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-blueprint bg-grid px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-ink font-display text-xl font-bold text-ember">
            F
          </span>
          <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-ink/60">Sign in to keep building your forms.</p>
        </div>

        <div className="card space-y-4 p-6 bg-white shadow-xl border border-ink/5 rounded-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-ember-light px-3 py-2 text-sm text-ember-dark">{error}</div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button disabled={loading} className="btn-primary w-full">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <>
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-ink/10"></div>
                <span className="flex-shrink mx-4 text-ink/40 text-xs uppercase font-semibold">Or</span>
                <div className="flex-grow border-t border-ink/10"></div>
              </div>
              <div id="google-signin-btn" className="w-full flex justify-center"></div>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-ink/60">
          New to Formify.ai?{" "}
          <Link to="/register" className="font-semibold text-steel hover:text-steel-dark">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
