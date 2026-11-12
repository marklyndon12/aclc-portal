import type { ReactNode } from "react";
import { Check, Info, Megaphone } from "lucide-react";

interface AuthShellProps {
  mode: "login" | "signup";
  children: ReactNode;
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {/* Replace /aclc-logo.svg with the official ACLC College logo asset. */}
      <img
        src="/aclc-logo.svg"
        alt="ACLC College logo"
        draggable={false}
        className={
          compact
            ? "h-10 w-10 rounded-xl border border-white/15 bg-white/10 object-contain p-1.5"
            : "h-12 w-12 rounded-xl border border-white/15 bg-white/10 object-contain p-1.5"
        }
      />
      <div>
        <p
          className={
            compact
              ? "text-base font-extrabold tracking-tight text-white"
              : "text-lg font-extrabold tracking-tight text-white"
          }
        >
          ACLC <span className="text-accent-400">College</span>
        </p>
        <p
          className={
            compact
              ? "text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-300"
              : "text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300"
          }
        >
          Student &amp; Faculty Portal
        </p>
      </div>
    </div>
  );
}

const signupBenefits = [
  "Live class schedules and room assignments",
  "Grades, attendance, and live ID in one place",
  "Secure single-device sessions",
];

export default function AuthShell({ mode, children }: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 auth-bg" />
      <div className="pointer-events-none absolute inset-0 auth-grid opacity-70" />
      <div className="pointer-events-none absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-accent-700/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-blue-900/20 blur-3xl" />

      <div className="animate-card-in relative w-full max-w-6xl rounded-[1.75rem] bg-gradient-to-br from-white/20 via-white/[0.08] to-transparent p-px shadow-2xl shadow-black/60">
        <div className="grid overflow-hidden rounded-[calc(1.75rem-1px)] bg-[#080c16]/90 backdrop-blur-2xl lg:grid-cols-[1.02fr_0.98fr]">
          <section className="relative hidden flex-col justify-between overflow-hidden p-9 lg:flex xl:p-12">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-950/70 via-[#0b1020]/90 to-[#080c16]" />
            <div className="pointer-events-none absolute inset-0 auth-grid opacity-40" />
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent-600/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-blue-800/20 blur-3xl" />

            <div className="relative">
              <BrandMark />
            </div>

            <div className="relative mt-10">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-300">
                {mode === "login" ? "One secure portal" : "Join the portal"}
              </p>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight text-white xl:text-5xl">
                {mode === "login" ? (
                  <>
                    Your campus,<br />
                    <span className="text-accent-400">all in one place.</span>
                  </>
                ) : (
                  <>
                    Start strong.<br />
                    <span className="text-accent-400">Stay connected.</span>
                  </>
                )}
              </h1>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-slate-300">
                {mode === "login"
                  ? "Check your schedule, grades, attendance, and announcements without the paperwork. Built for students and faculty who move fast."
                  : "Create one account for your schedule, grades, attendance, and campus announcements — whether you are enrolled or teaching."}
              </p>

              {mode === "login" ? (
                <>
                  <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                    <div className="flex items-center gap-2 text-accent-300">
                      <Megaphone size={16} />
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em]">
                        Announcements
                      </p>
                    </div>
                    <p className="mt-3 text-sm text-slate-400">
                      No announcements available.
                    </p>
                  </div>

                  <div className="mt-8 grid grid-cols-2 gap-3 text-xs text-slate-300">
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
                      <p className="text-base font-bold text-white">24/7</p>
                      Portal access
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
                      <p className="text-base font-bold text-white">1 device</p>
                      Secure session at a time
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <ul className="mt-8 space-y-3 text-sm text-slate-300">
                    {signupBenefits.map((benefit) => (
                      <li key={benefit} className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent-400/25 bg-accent-500/10 text-accent-300">
                          <Check size={16} />
                        </span>
                        {benefit}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                    <div className="flex items-center gap-2 text-accent-300">
                      <Info size={16} />
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em]">
                        Approval notice
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">
                      New accounts may be reviewed by the registrar before activation.
                    </p>
                  </div>
                </>
              )}
            </div>

            <p className="relative mt-10 text-xs text-slate-400">
              © {new Date().getFullYear()} ACLC College. All rights reserved.
            </p>
          </section>

          <section className="relative p-6 sm:p-9 lg:p-10 xl:p-12">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <BrandMark compact />
            </div>
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
