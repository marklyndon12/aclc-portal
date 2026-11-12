import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Layers,
  MapPin,
  User,
} from "lucide-react";
import { GlassSelect } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import type { Course } from "../../types";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function overlaps(a: Course, b: Course): boolean {
  if (a.day !== b.day) return false;
  if (!a.start_time || !a.end_time || !b.start_time || !b.end_time) return false;
  return a.start_time < b.end_time && a.end_time > b.start_time;
}

function conflictLabel(a: Course, b: Course): string | null {
  if (!overlaps(a, b)) return null;
  const reasons: string[] = [];
  if (a.teacher_name && a.teacher_name === b.teacher_name) reasons.push("teacher");
  if (a.section_name && a.section_name === b.section_name) reasons.push("section");
  if (
    a.room &&
    b.room &&
    a.room.trim().toLowerCase() === b.room.trim().toLowerCase()
  ) {
    reasons.push("room");
  }
  if (reasons.length === 0) return null;
  return `${a.course_code} ↔ ${b.course_code} · ${a.day} · ${reasons.join(", ")}`;
}

export default function ManageSchedule() {
  const { data } = useAdminData();
  const [sectionFilter, setSectionFilter] = useState("all");

  const visibleCourses = useMemo(() => {
    const list =
      sectionFilter === "all"
        ? data.courses
        : data.courses.filter((course) => course.section_name === sectionFilter);
    return [...list].sort((a, b) =>
      (a.start_time ?? "").localeCompare(b.start_time ?? "")
    );
  }, [data.courses, sectionFilter]);

  const conflicts = useMemo(() => {
    const found = new Set<string>();
    for (let i = 0; i < data.courses.length; i += 1) {
      for (let j = i + 1; j < data.courses.length; j += 1) {
        const label = conflictLabel(data.courses[i], data.courses[j]);
        if (label) found.add(label);
      }
    }
    return [...found];
  }, [data.courses]);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge border-accent/40 bg-accent/15 text-accent">
            Timetable
          </span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100">Weekly Schedule</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Read-only weekly timetable generated from course offerings. Conflicts are
            detected automatically.
          </p>
        </div>
        <div className="w-full sm:w-56">
          <GlassSelect
            label="Section"
            value={sectionFilter}
            onChange={(event) => setSectionFilter(event.target.value)}
          >
            <option value="all">All sections</option>
            {data.sections.map((section) => (
              <option key={section.section_id} value={section.section_name}>
                {section.section_name}
              </option>
            ))}
          </GlassSelect>
        </div>
      </section>

      {conflicts.length > 0 ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={16} />
            {conflicts.length} schedule conflict{conflicts.length > 1 ? "s" : ""} detected
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-100/90">
            {conflicts.map((conflict) => (
              <li key={conflict}>• {conflict}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <CalendarDays size={16} />
          No teacher, section, or room conflicts in the current timetable.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {DAYS.map((day) => {
          const courses = visibleCourses.filter((course) => course.day === day);
          return (
            <div key={day} className="glass bg-white/[0.06] p-3">
              <div className="mb-3 flex items-center justify-between gap-2 px-1">
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-300">
                  {day}
                </h2>
                <span className="badge border-white/10 bg-white/5 text-[10px] text-gray-400">
                  {courses.length}
                </span>
              </div>

              <div className="space-y-2.5">
                {courses.length > 0 ? (
                  courses.map((course) => (
                    <article
                      key={course.course_id}
                      className="rounded-xl border border-white/10 bg-slate-900/60 p-3 transition hover:border-accent/40 hover:bg-slate-900/80"
                    >
                      <p className="text-xs font-bold text-accent">{course.course_code}</p>
                      <p className="mt-0.5 text-sm font-semibold leading-snug text-gray-100">
                        {course.course_name}
                      </p>
                      <div className="mt-2 space-y-1 text-[11px] text-gray-400">
                        <p className="flex items-center gap-1.5">
                          <Clock size={11} className="shrink-0" />
                          {course.start_time}-{course.end_time}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Layers size={11} className="shrink-0" />
                          {course.section_name ?? "Unassigned"}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <MapPin size={11} className="shrink-0" />
                          {course.room ?? "No room"}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <User size={11} className="shrink-0" />
                          {course.teacher_name ?? "Unassigned"}
                        </p>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-[11px] text-gray-500">
                    No classes
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
