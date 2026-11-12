import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  MapPin,
  QrCode,
  ScanLine,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";
import ScannerModal from "../../components/ScannerModal";
import type { Course, ScanResult, TeacherProfile } from "../../types";

const myCourses: Course[] = [];

interface RecentScan {
  id: number;
  student_name: string;
  status: string;
  time: string;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Course | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

  const profile =
    user?.roles === "teacher" ? (user.profile as TeacherProfile | null) : null;
  const name = profile?.full_name ?? user?.username ?? "Teacher";
  const firstName = name.split(" ")[0];

  const totalStudents = myCourses.reduce((sum, course) => sum + course.enrolled, 0);

  const handleScanned = useCallback((result: ScanResult) => {
    setRecentScans((previous) =>
      [
        { id: Date.now() + Math.floor(Math.random() * 1000), ...result },
        ...previous,
      ].slice(0, 6)
    );
  }, []);

  return (
    <div className="space-y-6">
      <section className="glass relative overflow-hidden bg-white/10 p-6 shadow-glass sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative">
          <span className="badge border-accent/40 bg-accent/15 text-accent">
            Teacher Portal
          </span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100 sm:text-3xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Select a course to manage grades or launch the live attendance scanner.
          </p>

          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="badge border-white/15 bg-white/5 text-gray-300">
              <BookOpen size={13} />
              {myCourses.length} courses
            </span>
            <span className="badge border-white/15 bg-white/5 text-gray-300">
              <Users size={13} />
              {totalStudents} students
            </span>
            <span className="badge border-white/15 bg-white/5 text-gray-300">
              <CheckCircle2 size={13} />
              {recentScans.length} scans today
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-100">My Courses</h2>
              <p className="text-xs text-gray-500">Tap a card to reveal actions</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {myCourses.map((course) => {
                const isSelected = selected?.course_id === course.course_id;
                return (
                  <button
                    key={course.course_id}
                    type="button"
                    onClick={() =>
                      setSelected(isSelected ? null : course)
                    }
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
                        {course.section_name}
                      </span>
                    </div>

                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-accent">
                      {course.course_code}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-gray-100">
                      {course.course_name}
                    </p>

                    <div className="mt-4 space-y-1.5 text-xs text-gray-400">
                      <p className="flex items-center gap-1.5">
                        <Clock size={13} />
                        {course.day} · {course.start_time} - {course.end_time}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <MapPin size={13} />
                        {course.room}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Users size={13} />
                        {course.enrolled} enrolled
                      </p>
                    </div>
                  </button>
                );
              })}
              {myCourses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-5 py-12 text-center sm:col-span-2">
                  <BookOpen size={26} className="mx-auto text-gray-500" />
                  <p className="mt-3 text-sm font-semibold text-gray-200">
                    No courses assigned
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Courses assigned to your account will appear here.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {selected ? (
            <section className="glass bg-white/10 p-5 shadow-lg sm:p-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-500">
                    Selected course
                  </p>
                  <h3 className="text-base font-semibold text-gray-100">
                    {selected.course_code} · {selected.course_name}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {selected.section_name} · {selected.day}{" "}
                    {selected.start_time}-{selected.end_time}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => navigate("/teacher/grades")}
                  className="btn-glass w-full"
                >
                  <Award size={16} />
                  Manage Grades
                </button>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="btn-accent w-full"
                >
                  <ScanLine size={16} />
                  Launch Attendance Scanner
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
              <h2 className="text-sm font-semibold text-gray-100">Recent Scans</h2>
              <p className="text-xs text-gray-400">Live attendance feed</p>
            </div>
          </div>

          {recentScans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-10 text-center">
              <QrCode size={26} className="mx-auto mb-2 text-gray-500" />
              <p className="text-xs text-gray-400">
                No scans yet. Launch the scanner to record attendance.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {recentScans.map((scan) => (
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
                      {scan.status} · {scan.time}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <ScannerModal
        open={scannerOpen}
        course={selected}
        onClose={() => setScannerOpen(false)}
        onScanned={handleScanned}
      />
    </div>
  );
}
