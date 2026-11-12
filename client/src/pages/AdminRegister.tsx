import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "../lib/api";
import AuthShell from "../components/auth/AuthShell";
import { AuthInput } from "../components/auth/AuthInput";

interface FieldErrors {
  username?: string;
  password?: string;
  confirm?: string;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export default function AdminRegister() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clearError = (field: keyof FieldErrors) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: FieldErrors = {};
    if (username.trim().length < 3) {
      nextErrors.username = "Username must be at least 3 characters.";
    } else if (!USERNAME_PATTERN.test(username.trim())) {
      nextErrors.username = "Use only letters, numbers, dots, dashes, or underscores.";
    }
    if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }
    if (confirm !== password) {
      nextErrors.confirm = "Passwords do not match.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setFormError(null);
      return;
    }

    setErrors({});
    setFormError(null);
    setSubmitting(true);

    try {
      await api.post("/api/auth/admin-register", {
        username: username.trim(),
        password,
      });
      toast.success("Admin account created. Please sign in.");
      navigate("/login", { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Unable to create the admin account. Please try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell mode="signup">
      <div className="mx-auto w-full max-w-md">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-accent-400">
          Temporary setup
        </p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white">
          Register administrator
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Create the first admin account for the portal. This page closes
          automatically once an admin exists.
        </p>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3.5 py-3 text-xs leading-relaxed text-amber-200">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            Temporary page. Remove the route and navigation link after the first
            admin account is created.
          </span>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
          <AuthInput
            id="admin_username"
            name="username"
            label="Admin username"
            icon={<User size={18} />}
            placeholder="Choose an admin username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              if (errors.username) clearError("username");
            }}
            error={errors.username}
            disabled={submitting}
            required
          />

          <AuthInput
            id="admin_password"
            name="new-password"
            label="Password"
            type="password"
            icon={<Lock size={18} />}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (errors.password) clearError("password");
            }}
            error={errors.password}
            disabled={submitting}
            required
          />

          <AuthInput
            id="admin_confirm_password"
            name="confirm-password"
            label="Confirm password"
            type="password"
            icon={<Lock size={18} />}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value);
              if (errors.confirm) clearError("confirm");
            }}
            error={errors.confirm}
            disabled={submitting}
            required
          />

          {formError ? (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2.5 rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="btn-accent w-full py-3 text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080c16]"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Creating admin...
              </>
            ) : (
              <>
                Create Admin Account
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an admin account?{" "}
          <Link
            to="/login"
            className="rounded font-semibold text-accent-400 transition hover:text-accent-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
          >
            Sign in
          </Link>
        </p>

        <div className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-slate-400">
          <ShieldCheck size={15} className="text-emerald-400" />
          Available only until the first admin account is created.
        </div>
      </div>
    </AuthShell>
  );
}
