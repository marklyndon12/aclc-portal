import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  MapPin,
  QrCode,
  ScanLine,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";
import ScannerModal from "../../components/ScannerModal";
import { LoadState } from "../../components/teacher/ClassSelect";
import { useTeacherOverview } from "../../hooks/useTeacherOverview";
import type { ScanResult, TeacherClass } from "../../types";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useTeacherOverview();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const classes = data?.classes ?? [];
  const selected: TeacherClass | null =
    classes.find((item) => item.class_id === selectedId) ?? null;

  const name = data?.profile.full_name ?? user?.username ?? "Teacher";
  const firstName = name.split(" ")[0];
  const totalStudents = classes.reduce((sum, item) => sum + item.enrolled, 0);

  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todayClasses = classes
    .filter((item) => item.day === weekday)
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));

  const handleScanned = useCallback(
    (_result: ScanResult) => {
      void refresh();
    },
    [refresh]
  );

  return (
    <div className="space-y-6">
      <section className="glass relative overflow-hidden bg-white/10 p-6 shadow-glass sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative">
          <span className="badge border-accent/40 bg-accent/15 text-accent">Teacher Portal</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100 sm:text-3xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            {data?.profile.department ? `${data.profile.department} · ` : ""}
            Select a class to take attendance or manage grades.
          </p>

          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="badge border-white/15 bg-white/5 text-gray-300">
              <BookOpen size={13} />
              {classes.length} classes
            </span>
            <span className="badge border-white/15 bg-white/5 text-gray-300">
              <Users size={13} />
              {totalStudents} students
            </span>
            <span className="badge border-white/15 bg-white/5 text-gray-300">
              <CheckCircle2 size={13} />
              {data?.recent.length ?? 0} recorded today
            </span>
          </div>
        </div>
      </section>

      <LoadState loading={loading} error={error} onRetry={refresh} />

      {!loading && !error ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="glass overflow-hidden bg-white/10">
              <div className="border-b border-white/10 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-100">Today&apos;s classes</h2>
                <p className="text-xs text-gray-400">{weekday}</p>
              </div>
              <div className="divide-y divide-white/10">
                {todayClasses.length > 0 ? (
                  todayClasses.map((item) => (
                    <div key={item.class_id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                      <div className="min-w-[92px]">
                        <p className="text-sm font-semibold text-gray-100">{item.start_time}</p>
                        <p className="text-[11px] text-gray-500">to {item.end_time}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-100">
                          <span className="text-accent">{item.subject_code}</span> {item.subject_name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.section_name} · {item.room ?? "No room"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/teacher/attendance?class=${item.class_id}`)}
                        className="btn-glass text-xs"
                      >
                        <ClipboardCheck size={14} />
                        Attendance
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="px-5 py-8 text-center text-sm text-gray-400">
                    No classes scheduled for {weekday}.
                  </p>
                )}
              </div>
            </section>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-100">My Classes</h2>
                <p className="text-xs text-gray-500">Tap a card to reveal actions</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {classes.map((item) => {
                  const isSelected = selected?.class_id === item.class_id;
                  return (
                    <button
                      key={item.class_id}
                      type="button"
                      onClick={() => setSelectedId(isSelected ? null : item.class_id)}
                      className={clsx(
                        "group relative overflow-hidden rounded-2xl border p-5 text-left backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:bg-white/15",
                        isSelected
                          ? "border-accent/60 bg-white/15 shadow-lg shadow-accent/20 ring-2 ring-accent/50"
                          : "border-white/20 bg-white/10 shadow-lg hover:border-white/30"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
                          <BookOpen size={18} />
                        </div>
                        <span className="badge border-white/15 bg-white/5 text-gray-300">
                          {item.section_name}
                        </span>
                      </div>

                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-accent">
                        {item.subject_code}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm font-semibold text-gray-100">
                        {item.subject_name}
                      </p>

                      <div className="mt-4 space-y-1.5 text-xs text-gray-400">
                        <p className="flex items-center gap-1.5">
                          <Clock size={13} />
                          {item.day && item.start_time
                            ? `${item.day} · ${item.start_time} - ${item.end_time}`
                            : "Not scheduled yet"}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <MapPin size={13} />
                          {item.room ?? "No room"}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Users size={13} />
                          {item.enrolled} enrolled
                        </p>
                      </div>
                    </button>
                  );
                })}
                {classes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-5 py-12 text-center sm:col-span-2">
                    <BookOpen size={26} className="mx-auto text-gray-500" />
                    <p className="mt-3 text-sm font-semibold text-gray-200">No classes assigned</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Classes the admin assigns to you will appear here.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            {selected ? (
              <section className="glass bg-white/10 p-5 shadow-lg sm:p-6">
                <p className="text-xs uppercase tracking-widest text-gray-500">Selected class</p>
                <h3 className="text-base font-semibold text-gray-100">
                  {selected.subject_code} · {selected.subject_name}
                </h3>
                <p className="text-xs text-gray-400">
                  {selected.section_name} · {selected.course_code} · {selected.year_level}
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/teacher/grades?class=${selected.class_id}`)}
                    className="btn-glass w-full"
                  >
                    <Award size={16} />
                    Manage Grades
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/teacher/attendance?class=${selected.class_id}`)}
                    className="btn-glass w-full"
                  >
                    <ClipboardCheck size={16} />
                    Attendance
                  </button>
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="btn-accent w-full"
                  >
                    <ScanLine size={16} />
                    Scan QR
                  </button>
                </div>
              </section>
            ) : null}
          </div>

          <aside className="glass h-fit bg-white/10 p-5 shadow-lg">
            <div className="mb-4 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent">
                <QrCode size={18} />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-gray-100">Recorded today</h2>
                <p className="text-xs text-gray-400">Latest attendance in your classes</p>
              </div>
            </div>

            {(data?.recent.length ?? 0) === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-10 text-center">
                <QrCode size={26} className="mx-auto mb-2 text-gray-500" />
                <p className="text-xs text-gray-400">
                  Nothing recorded yet today. Scan a QR or take attendance by hand.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {data?.recent.map((scan) => (
                  <li
                    key={scan.id}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <CheckCircle2 size={16} className="shrink-0 text-green-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-100">
                        {scan.student_name}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {scan.status} · {scan.class_label}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      ) : null}

      <ScannerModal
        open={scannerOpen}
        course={selected}
        onClose={() => setScannerOpen(false)}
        onScanned={handleScanned}
      />
    </div>
  );
}
