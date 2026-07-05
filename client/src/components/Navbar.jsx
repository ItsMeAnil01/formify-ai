import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-ember font-display text-lg font-bold">
            F
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">Formify.ai</span>
        </Link>

        {user && (
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-ink/60 sm:inline">
              Hi, <span className="font-medium text-ink">{user.name.split(" ")[0]}</span>
            </span>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="btn-ghost"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
