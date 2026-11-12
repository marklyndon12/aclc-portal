import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function SessionExpiredModal() {
  const { sessionExpired, dismissSessionExpired } = useAuth();
  const navigate = useNavigate();

  if (!sessionExpired) {
    return null;
  }

  const goToLogin = () => {
    dismissSessionExpired();
    navigate("/login", { replace: true });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-sm bg-slate-900/80 p-6 text-center shadow-glass">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent">
          <ShieldAlert size={24} />
        </div>
        <h2 className="text-lg font-semibold text-gray-100">Session Expired</h2>
        <p className="mt-2 text-sm text-gray-400">
          This account was signed in on another device, or the session is no
          longer valid. Please sign in again.
        </p>
        <button type="button" onClick={goToLogin} className="btn-accent mt-5 w-full">
          Go to login
        </button>
      </div>
    </div>
  );
}
