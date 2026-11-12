import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  CalendarDays,
  Clock,
  GraduationCap,
  Hash,
  Layers,
  MapPin,
  QrCode,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import LoadState from "../../components/LoadState";
import { useStudentData } from "../../hooks/useStudentOverview";
import type { StudentOverview } from "../../types";
import LiveQrModal from "./LiveQrModal";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useStudentData<StudentOverview>("/api/student/overview");
  const [qrOpen, setQrOpen] = useState(false);

  const profile = data?.profile;
  const name = profile?.full_name ?? user?.username ?? "Student";
  const firstName = name.split(" ")[0];
  const section = profile?.section ?? "…";
  const studentNumber = profile?.student_number ?? "—";
  const programYear = [profile?.course_code, profile?.year_level].filter(Boolean).join(" · ");

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todaysClasses = (data?.classes ?? [])
    .filter((item) => item.day === today)
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  const recentGrades = data?.recent_grades ?? [];
  const unassigned = profile?.section === "Unassigned";

  return (
    <div className="space-y-6">
      <section className="glass relative overflow-hidden bg-white/10 p-6 shadow-glass sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <span className="badge border-accent/40 bg-accent/15 text-accent">Student Portal</span>
            <h1 className="mt-3 text-2xl font-bold text-gray-100 sm:text-3xl">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-gray-400">
              Here is your day at a glance — {today}. Keep your live ID ready for attendance scans.
            </p>

            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="badge border-white/15 bg-white/5 text-gray-300">
                <Layers size={13} />
                {section}
              </span>
              {programYear ? (
                <span className="badge border-white/15 bg-white/5 text-gray-300">
                  <GraduationCap size={13} />
                  {programYear}
                </span>
              ) : null}
              <span className="badge border-white/15 bg-white/5 text-gray-300">
                <Hash size={13} />
                {studentNumber}
              </span>
            </div>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              disabled={unassigned}
              className="group relative inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-accent px-6 py-4 text-base font-semibold text-white shadow-xl shadow-accent/40 transition-all duration-300 hover:scale-105 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 sm:w-auto"
            >
              <span className="absolute inset-0 -z-10 rounded-2xl bg-accent/60 animate-pulse-ring" />
              <QrCode size={22} className="transition-transform duration-300 group-hover:scale-110" />
              Show Live ID
            </button>
            <p className="mt-2 text-center text-[11px] text-gray-500">
              {unassigned
                ? "Available once you are assigned to a section"
                : "Refreshes automatically every 15 seconds"}
            </p>
          </div>
        </div>
      </section>

      <LoadState loading={loading} error={error} onRetry={refresh} />

      {unassigned ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          You are not assigned to a section yet. Please ask the registrar — your classes and
          grades will appear once you are.
        </p>
      ) : null}

      {!loading && !error ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="glass bg-white/10 p-5 shadow-lg sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent">
                  <CalendarDays size={18} />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-gray-100">Today&apos;s Classes</h2>
                  <p className="text-xs text-gray-400">{today}</p>
                </div>
              </div>
              <Link
                to="/student/schedule"
                className="text-xs font-medium text-accent transition hover:text-accent-300"
              >
                View week
              </Link>
            </div>

            {todaysClasses.length > 0 ? (
              <ul>
                {todaysClasses.map((item) => (
                  <li
                    key={item.class_id}
                    className="flex items-center gap-3 border-b border-white/10 py-3 last:border-b-0"
                  >
                    <div className="w-16 shrink-0 rounded-xl border border-accent/20 bg-accent/10 px-2 py-2 text-center">
                      <p className="text-xs font-bold text-accent">{item.start_time}</p>
                      <p className="text-[10px] text-accent/70">{item.end_time}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-100">
                        {item.subject_name}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        {item.subject_code} · {item.teacher_name ?? "Teacher not assigned"}
                      </p>
                    </div>
                    <span className="hidden items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-gray-300 sm:inline-flex">
                      <MapPin size={12} />
                      {item.room ?? "No room"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-10 text-center">
                <CalendarDays size={24} className="mx-auto text-gray-500" />
                <p className="mt-2 text-sm font-medium text-gray-300">No classes scheduled today</p>
              </div>
            )}
          </section>

          <section className="glass bg-white/10 p-5 shadow-lg sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent">
                  <Award size={18} />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-gray-100">Recent Grades</h2>
                  <p className="text-xs text-gray-400">Latest posted results</p>
                </div>
              </div>
              <Link
                to="/student/grades"
                className="text-xs font-medium text-accent transition hover:text-accent-300"
              >
                View all
              </Link>
            </div>

            {recentGrades.length > 0 ? (
              <ul>
                {recentGrades.map((item) => {
                  const passed = (item.grade_value ?? 0) >= 75;
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 border-b border-white/10 py-3 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-100">
                          {item.subject_name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.subject_code}
                          {item.gpa !== null ? ` · GPA ${item.gpa.toFixed(2)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={
                            passed ? "text-lg font-bold text-green-400" : "text-lg font-bold text-red-400"
                          }
                        >
                          {item.grade_value?.toFixed(1)}
                        </span>
                        <span
                          className={
                            passed
                              ? "badge border-green-400/30 bg-green-400/10 text-green-400"
                              : "badge border-red-400/30 bg-red-400/10 text-red-400"
                          }
                        >
                          {passed ? "Passed" : "Failed"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-10 text-center">
                <Award size={24} className="mx-auto text-gray-500" />
                <p className="mt-2 text-sm font-medium text-gray-300">No grades posted yet</p>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-400">
              <TrendingUp size={14} className="text-emerald-400" />
              Passing threshold is 75. Keep your average above the line.
            </div>
          </section>
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Clock size={14} />
        Attendance is recorded when your teacher scans your live QR code.
      </div>

      <LiveQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        studentName={name}
        studentNumber={studentNumber}
        section={section}
      />
    </div>
  );
}
