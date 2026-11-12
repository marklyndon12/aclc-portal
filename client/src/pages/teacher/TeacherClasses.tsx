import { useState } from "react";
import { BookOpen, Clock, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import Modal from "../../components/Modal";
import { LoadState, NoClasses } from "../../components/teacher/ClassSelect";
import { api, ApiError } from "../../lib/api";
import { useTeacherOverview } from "../../hooks/useTeacherOverview";
import type { TeacherClass } from "../../types";

interface RosterStudent {
  student_id: number;
  student_number: string;
  full_name: string;
}

export default function TeacherClasses() {
  const { data, loading, error, refresh } = useTeacherOverview();
  const [open, setOpen] = useState<TeacherClass | null>(null);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  const classes = data?.classes ?? [];

  const openRoster = async (item: TeacherClass) => {
    setOpen(item);
    setRoster([]);
    setLoadingRoster(true);
    try {
      const result = await api.get<{ students: RosterStudent[] }>(
        `/api/teacher/classes/${item.class_id}/students`
      );
      setRoster(result.students);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load students");
    } finally {
      setLoadingRoster(false);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <span className="badge border-accent/40 bg-accent/15 text-accent">Teaching</span>
        <h1 className="mt-3 text-2xl font-bold text-gray-100">My Classes</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Every class assigned to you, with its schedule and student list.
        </p>
      </section>

      <LoadState loading={loading} error={error} onRetry={refresh} />

      {!loading && !error && classes.length === 0 ? <NoClasses /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {classes.map((item) => (
          <article key={item.class_id} className="glass bg-white/10 p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
                <BookOpen size={18} />
              </span>
              <span className="badge border-white/15 bg-white/5 text-gray-300">
                {item.section_name}
              </span>
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-accent">
              {item.subject_code} · {item.units} units
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-100">{item.subject_name}</p>
            <p className="text-xs text-gray-500">
              {item.course_code} · {item.year_level}
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
            </div>

            <button
              type="button"
              onClick={() => openRoster(item)}
              className="btn-glass mt-4 w-full"
            >
              <Users size={15} />
              View {item.enrolled} student{item.enrolled === 1 ? "" : "s"}
            </button>
          </article>
        ))}
      </div>

      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? `${open.subject_code} · ${open.section_name}` : "Students"}
        description={open?.subject_name}
        size="lg"
      >
        {loadingRoster ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : roster.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            No students are enrolled in this section yet.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                  <th className="px-3 py-2 font-semibold">Student no.</th>
                  <th className="px-3 py-2 font-semibold">Name</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((student) => (
                  <tr key={student.student_id} className="border-b border-white/10 last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs text-accent">
                      {student.student_number}
                    </td>
                    <td className="px-3 py-2 text-gray-100">{student.full_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
