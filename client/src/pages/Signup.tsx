import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "../lib/api";
import { homePath } from "../lib/roles";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/auth/AuthShell";
import { AuthInput } from "../components/auth/AuthInput";
import type { SignupPayload } from "../types";

type AccountRole = "student" | "teacher";

interface FieldErrors {
  full_name?: string;
  email?: string;
  username?: string;
  password?: string;
  confirm?: string;
  terms?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export default function Signup() {
  const { signup, user } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<AccountRole>("student");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={homePath(user.roles)} replace />;
  }

  const clearError = (field: keyof FieldErrors) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: FieldErrors = {};
    if (fullName.trim().length < 2) nextErrors.full_name = "Enter your full name.";
    if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
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
    if (!terms) {
      nextErrors.terms = "Please accept the acceptable use policy.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setFormError(null);
      return;
    }

    const payload: SignupPayload = {
      full_name: fullName.trim(),
      email: email.trim(),
      username: username.trim(),
      role,
      password,
    };

    setErrors({});
    setFormError(null);
    setSubmitting(true);

    try {
      const created = await signup(payload, true);
      toast.success("Account created. Welcome to the portal.");
      navigate(homePath(created.roles), { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Unable to create your account. Please try again.";
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
          New account
        </p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white">
          Create your account
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Register once to access schedules, grades, attendance, and announcements.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
          <AuthInput
            id="full_name"
            name="full_name"
            label="Full name"
            icon={<User size={18} />}
            placeholder="Enter your full name"
            autoComplete="name"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              if (errors.full_name) clearError("full_name");
            }}
            error={errors.full_name}
            disabled={submitting}
            required
          />

          <AuthInput
            id="email"
            name="email"
            label="School email"
            type="email"
            icon={<Mail size={18} />}
            placeholder="Enter your school email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (errors.email) clearError("email");
            }}
            error={errors.email}
            disabled={submitting}
            required
          />

          <AuthInput
            id="signup_username"
            name="username"
            label="Username"
            icon={<User size={18} />}
            placeholder="Choose a username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              if (errors.username) clearError("username");
            }}
            error={errors.username}
            hint="Letters, numbers, dots, dashes, and underscores."
            disabled={submitting}
            required
          />

          <fieldset>
            <legend className="mb-1.5 block text-sm font-semibold text-slate-200">
              I am a
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  {
                    value: "student" as const,
                    label: "Student",
                    description: "Enrolled learner",
                    icon: <GraduationCap size={18} />,
                  },
                  {
                    value: "teacher" as const,
                    label: "Faculty",
                    description: "Teaching staff",
                    icon: <Briefcase size={18} />,
                  },
                ]
              ).map((option) => {
                const active = role === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition focus-within:ring-2 focus-within:ring-accent-500/60 ${
                      active
                        ? "border-accent-500/70 bg-accent-500/10 text-white"
                        : "border-white/15 bg-white/[0.04] text-slate-300 hover:border-white/25 hover:bg-white/[0.07]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={option.value}
                      checked={active}
                      onChange={() => setRole(option.value)}
                      disabled={submitting}
                      className="sr-only"
                    />
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${
                        active
                          ? "border-accent-400/40 bg-accent-500/20 text-accent-300"
                          : "border-white/15 bg-white/5 text-slate-400"
                      }`}
                    >
                      {option.icon}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="block text-xs text-slate-400">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <AuthInput
            id="signup_password"
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
            id="confirm_password"
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

          <div>
            <label className="inline-flex cursor-pointer items-start gap-2.5 text-sm text-slate-300">
              <input
                type="checkbox"
                name="terms"
                checked={terms}
                onChange={(event) => {
                  setTerms(event.target.checked);
                  if (errors.terms) clearError("terms");
                }}
                disabled={submitting}
                aria-invalid={errors.terms ? true : undefined}
                aria-describedby={errors.terms ? "terms-error" : undefined}
                className="mt-0.5 h-4 w-4 rounded border-white/30 bg-white/10 text-accent focus:ring-2 focus:ring-accent-500/60 focus:ring-offset-0"
              />
              I agree to the ACLC College acceptable use policy.
            </label>
            {errors.terms ? (
              <p id="terms-error" className="mt-1.5 text-xs font-medium text-red-300">
                {errors.terms}
              </p>
            ) : null}
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
                Creating account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already registered?{" "}
          <Link
            to="/login"
            className="rounded font-semibold text-accent-400 transition hover:text-accent-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
          >
            Sign in
          </Link>
        </p>

        <div className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-slate-400">
          <ShieldCheck size={15} className="text-emerald-400" />
          Your details are encrypted and used for school access only.
        </div>
      </div>
    </AuthShell>
  );
}
