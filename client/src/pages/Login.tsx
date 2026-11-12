import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Lock,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "../lib/api";
import { homePath } from "../lib/roles";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/auth/AuthShell";
import { AuthInput } from "../components/auth/AuthInput";

interface FieldErrors {
  username?: string;
  password?: string;
}

const SESSION_ACTIVE_CODES = new Set(["SESSION_ACTIVE", "ALREADY_SIGNED_IN"]);

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={homePath(user.roles)} replace />;
  }

  const from = (location.state as { from?: string } | null)?.from;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: FieldErrors = {};
    if (!username.trim()) nextErrors.username = "Enter your username.";
    if (!password) nextErrors.password = "Enter your password.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setFormError(null);
      return;
    }

    setErrors({});
    setFormError(null);
    setSubmitting(true);

    try {
      const signedIn = await login(username.trim(), password, remember);
      toast.success(`Welcome, ${signedIn.username}`);
      const fallback = homePath(signedIn.roles);
      const target = from && from.startsWith(`/${signedIn.roles}`) ? from : fallback;
      navigate(target, { replace: true });
    } catch (err) {
      let message = "Unable to sign in. Please try again.";
      if (err instanceof ApiError) {
        message = SESSION_ACTIVE_CODES.has(err.code ?? "")
          ? "This account is already signed in on another device. Sign out there first, then try again."
          : err.message;
      }
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell mode="login">
      <div className="mx-auto w-full max-w-md">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-accent-400">
          Account access
        </p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white">
          Sign in to your account
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Enter your school credentials to open the Student &amp; Faculty Portal.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
          <AuthInput
            id="username"
            name="username"
            label="Username"
            icon={<User size={18} />}
            placeholder="Enter your username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              if (errors.username) {
                setErrors((prev) => ({ ...prev, username: undefined }));
              }
            }}
            error={errors.username}
            disabled={submitting}
            required
          />

          <AuthInput
            id="password"
            name="password"
            label="Password"
            type="password"
            icon={<Lock size={18} />}
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (errors.password) {
                setErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
            error={errors.password}
            disabled={submitting}
            required
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-slate-300">
              <input
                type="checkbox"
                name="remember"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                disabled={submitting}
                className="h-4 w-4 rounded border-white/30 bg-white/10 text-accent focus:ring-2 focus:ring-accent-500/60 focus:ring-offset-0"
              />
              Remember me
            </label>

            <a
              href="mailto:it.support@aclc.edu.ph?subject=Password%20reset%20request"
              className="rounded text-sm font-semibold text-accent-400 transition hover:text-accent-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
            >
              Forgot password?
            </a>
          </div>

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
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          New to the portal?{" "}
          <Link
            to="/signup"
            className="rounded font-semibold text-accent-400 transition hover:text-accent-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
          >
            Create an account
          </Link>
        </p>

        <div className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-slate-400">
          <ShieldCheck size={15} className="text-emerald-400" />
          Protected by single-device session monitoring.
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} ACLC College. Need help?{" "}
          <a
            href="mailto:it.support@aclc.edu.ph"
            className="rounded text-slate-300 underline-offset-2 transition hover:text-white hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
          >
            Contact IT Support
          </a>
        </p>
      </div>
    </AuthShell>
  );
}
