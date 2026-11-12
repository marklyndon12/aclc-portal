import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Layers,
  Loader2,
  Lock,
  Sparkles,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "../lib/api";
import { homePath } from "../lib/roles";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/auth/AuthShell";
import { AuthInput } from "../components/auth/AuthInput";
import type { SignupPayload } from "../types";

type AccountRole = "student" | "teacher";

interface FieldErrors {
  full_name?: string;
  username?: string;
  section?: string;
  department?: string;
  password?: string;
  confirm?: string;
  terms?: string;
}

interface DepartmentOption {
  department_id: number;
  department_name: string;
}

interface SectionOption {
  section_name: string;
  course_code: string | null;
  year_level: string | null;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export default function Signup() {
  const { signup, user } = useAuth();
  
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<AccountRole>("student");
  const [section, setSection] = useState("");
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [specialization, setSpecialization] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ sections: SectionOption[] }>("/api/auth/sections")
      .then((result) => {
        if (!cancelled) setSections(result.sections);
      })
      .catch(() => {
        // The section list is optional; students can still register without it.
      });
    api
      .get<{ departments: DepartmentOption[] }>("/api/auth/departments")
      .then((result) => {
        if (!cancelled) setDepartments(result.departments);
      })
      .catch(() => {
        // Optional list; faculty can still register without it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (username.trim().length < 3) {
      nextErrors.username = "Username must be at least 3 characters.";
    } else if (!USERNAME_PATTERN.test(username.trim())) {
      nextErrors.username = "Use only letters, numbers, dots, dashes, or underscores.";
    }
    if (role === "student" && sections.length > 0 && !section) {
      nextErrors.section = "Choose your section.";
    }
    if (role === "teacher" && departments.length > 0 && !department) {
      nextErrors.department = "Choose your department.";
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
      username: username.trim(),
      role,
      password,
      ...(role === "student" && section ? { section } : {}),
      ...(role === "teacher" && department ? { department_id: Number(department) } : {}),
      ...(role === "teacher" && specialization.trim()
        ? { specialization: specialization.trim() }
        : {}),
    };

    setErrors({});
    setFormError(null);
    setSubmitting(true);

    try {
      await signup(payload);
      setSubmitted(true);
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

  if (submitted) {
    return (
      <AuthShell mode="signup">
        <div className="mx-auto w-full max-w-md text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
            <CheckCircle2 size={28} />
          </span>
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-white">
            Registration submitted
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Thanks, {fullName.trim().split(" ")[0]}. Your account is waiting for admin
            approval. You&apos;ll be able to sign in with{" "}
            <span className="font-semibold text-slate-200">{username.trim()}</span> once
            it&apos;s approved.
          </p>
          <Link to="/login" className="btn-accent mt-8 inline-flex w-full justify-center py-3 text-[15px]">
            Back to sign in
            <ArrowRight size={18} />
          </Link>
        </div>
      </AuthShell>
    );
  }

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

          {role === "student" ? (
            <div>
              <label
                htmlFor="signup_section"
                className="mb-1.5 block text-sm font-semibold text-slate-200"
              >
                Section
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Layers size={18} />
                </span>
                <select
                  id="signup_section"
                  name="section"
                  value={section}
                  onChange={(event) => {
                    setSection(event.target.value);
                    if (errors.section) clearError("section");
                  }}
                  disabled={submitting || sections.length === 0}
                  aria-invalid={errors.section ? true : undefined}
                  className={`w-full appearance-none rounded-xl border border-white/15 bg-white/[0.04] py-3 pl-11 pr-10 text-[15px] text-white transition duration-200 hover:border-white/25 focus:border-accent-500 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-accent-500/50 disabled:opacity-60 ${
                    errors.section ? "field-invalid" : ""
                  }`}
                >
                  <option value="" className="bg-slate-900">
                    {sections.length === 0 ? "No sections available yet" : "Select your section"}
                  </option>
                  {sections.map((item) => (
                    <option key={item.section_name} value={item.section_name} className="bg-slate-900">
                      {item.section_name}
                      {item.course_code ? ` · ${item.course_code}` : ""}
                      {item.year_level ? ` · ${item.year_level}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  className="pointer-events-none absolute inset-y-0 right-3 my-auto text-slate-400"
                />
              </div>
              {errors.section ? (
                <p className="mt-1.5 text-xs font-medium text-red-300">{errors.section}</p>
              ) : null}
            </div>
          ) : null}

          {role === "teacher" ? (
            <>
              <div>
                <label
                  htmlFor="signup_department"
                  className="mb-1.5 block text-sm font-semibold text-slate-200"
                >
                  Department
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Building2 size={18} />
                  </span>
                  <select
                    id="signup_department"
                    name="department"
                    value={department}
                    onChange={(event) => {
                      setDepartment(event.target.value);
                      if (errors.department) clearError("department");
                    }}
                    disabled={submitting || departments.length === 0}
                    aria-invalid={errors.department ? true : undefined}
                    className={`w-full appearance-none rounded-xl border border-white/15 bg-white/[0.04] py-3 pl-11 pr-10 text-[15px] text-white transition duration-200 hover:border-white/25 focus:border-accent-500 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-accent-500/50 disabled:opacity-60 ${
                      errors.department ? "field-invalid" : ""
                    }`}
                  >
                    <option value="" className="bg-slate-900">
                      {departments.length === 0
                        ? "No departments available yet"
                        : "Select your department"}
                    </option>
                    {departments.map((item) => (
                      <option
                        key={item.department_id}
                        value={item.department_id}
                        className="bg-slate-900"
                      >
                        {item.department_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={18}
                    className="pointer-events-none absolute inset-y-0 right-3 my-auto text-slate-400"
                  />
                </div>
                {errors.department ? (
                  <p className="mt-1.5 text-xs font-medium text-red-300">{errors.department}</p>
                ) : null}
              </div>

              <AuthInput
                id="signup_specialization"
                name="specialization"
                label="Specialization (optional)"
                icon={<Sparkles size={18} />}
                placeholder="e.g. Programming, Databases"
                autoComplete="off"
                value={specialization}
                onChange={(event) => setSpecialization(event.target.value)}
                disabled={submitting}
              />
            </>
          ) : null}

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
