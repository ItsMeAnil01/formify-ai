import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-paper text-center">
    <p className="font-display text-4xl font-semibold text-ink/20">404</p>
    <p className="mt-2 text-sm text-ink/60">This page doesn't exist.</p>
    <Link to="/dashboard" className="btn-secondary mt-5">
      Back to dashboard
    </Link>
  </div>
);

export default NotFound;
