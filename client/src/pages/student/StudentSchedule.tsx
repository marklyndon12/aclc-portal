import { CalendarDays, Clock, MapPin, User } from "lucide-react";
import LoadState from "../../components/LoadState";
import { useStudentData } from "../../hooks/useStudentOverview";
import type { StudentOverview } from "../../types";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function StudentSchedule() {
  const { data, loading, error, refresh } = useStudentData<StudentOverview>("/api/student/overview");
  const classes = data?.classes ?? [];
  const scheduled = classes.filter((item) => item.day && item.start_time);
  const unscheduled = classes.filter((item) => !item.day || !item.start_time);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <div className="space-y-6">
      <section>
        <span className="badge border-accent/40 bg-accent/15 text-accent">Timetable</span>
        <h1 className="mt-3 text-2xl font-bold text-gray-100">My Schedule</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          {data ? `${data.profile.section} · ${data.profile.year_level}` : "Your weekly classes."}
        </p>
      </section>

      <LoadState loading={loading} error={error} onRetry={refresh} />

      {!loading && !error && classes.length === 0 ? (
        <div className="glass bg-white/10 px-5 py-12 text-center">
          <CalendarDays size={22} className="mx-auto text-gray-500" />
          <p className="mt-2 text-sm text-gray-300">No classes yet</p>
          <p className="mt-1 text-xs text-gray-500">
            Your classes appear once you have a section and the admin schedules them.
          </p>
        </div>
      ) : null}

      {classes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {DAYS.map((day) => {
            const items = scheduled
              .filter((item) => item.day === day)
              .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
            return (
              <div
                key={day}
                className={`glass p-3 ${day === today ? "bg-accent/10 ring-1 ring-accent/40" : "bg-white/[0.06]"}`}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-300">{day}</h2>
                  {day === today ? (
                    <span className="badge border-accent/40 bg-accent/15 text-[10px] text-accent">Today</span>
                  ) : null}
                </div>
                <div className="space-y-2.5">
                  {items.length > 0 ? (
                    items.map((item) => (
                      <article
                        key={item.class_id}
                        className="rounded-xl border border-white/10 bg-slate-900/60 p-3"
                      >
                        <p className="text-xs font-bold text-accent">{item.subject_code}</p>
                        <p className="mt-0.5 text-sm font-semibold leading-snug text-gray-100">
                          {item.subject_name}
                        </p>
                        <div className="mt-2 space-y-1 text-[11px] text-gray-400">
                          <p className="flex items-center gap-1.5">
                            <Clock size={11} className="shrink-0" />
                            {item.start_time}-{item.end_time}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <MapPin size={11} className="shrink-0" />
                            {item.room ?? "No room"}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <User size={11} className="shrink-0" />
                            {item.teacher_name ?? "Teacher not assigned"}
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
      ) : null}

      {unscheduled.length > 0 ? (
        <section className="glass bg-white/[0.06] p-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-300">
            Time not set yet
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm text-gray-300">
            {unscheduled.map((item) => (
              <li key={item.class_id}>
                <span className="font-semibold text-accent">{item.subject_code}</span> {item.subject_name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
