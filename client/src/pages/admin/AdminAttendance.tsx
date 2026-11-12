import { useMemo, useState } from "react";
import { CheckCheck, ClipboardCheck, Users } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { GlassInput, GlassSelect } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import type { AttendanceStatus } from "../../types";

const STATUSES: AttendanceStatus[] = ["Present", "Late", "Absent", "Excused"];

const statusClass: Record<AttendanceStatus, string> = {
  Present: "border-green-400/30 bg-green-400/10 text-green-300",
  Late: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  Absent: "border-red-400/30 bg-red-400/10 text-red-300",
  Excused: "border-sky-400/30 bg-sky-400/10 text-sky-300",
};

export default function AdminAttendance() {
  const { data, setData } = useAdminData();
  const [courseId, setCourseId] = useState(() => String(data.courses[0]?.course_id ?? ""));
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const course = data.courses.find((item) => item.course_id === Number(courseId));

  const roster = useMemo(() => {
    if (!course) return data.students;
    if (!course.section_name) return data.students;
    return data.students.filter((student) => student.section === course.section_name);
  }, [course, data.students]);

  const records = useMemo(
    () =>
      data.attendance.filter(
        (record) => record.course_id === Number(courseId) && record.date === date
      ),
    [data.attendance, courseId, date]
  );

  const statusFor = (studentId: number): AttendanceStatus =>
    records.find((record) => record.student_id === studentId)?.status ?? "Absent";

  const summary = STATUSES.map((status) => ({
    status,
    count: roster.filter((student) => statusFor(student.student_id) === status).length,
  }));

  const setStatus = (studentId: number, status: AttendanceStatus) => {
    setData((previous) => {
      const existing = previous.attendance.find(
        (record) =>
          record.course_id === Number(courseId) &&
          record.student_id === studentId &&
          record.date === date
      );

      if (existing) {
        return {
          ...previous,
          attendance: previous.attendance.map((record) =>
            record.id === existing.id ? { ...record, status } : record
          ),
        };
      }

      return {
        ...previous,
        attendance: [
          ...previous.attendance,
          {
            id: Date.now() + studentId,
            course_id: Number(courseId),
            student_id: studentId,
            date,
            status,
          },
        ],
      };
    });
  };

  const markAllPresent = () => {
    if (roster.length === 0) return;
    setData((previous) => {
      const others = previous.attendance.filter(
        (record) => !(record.course_id === Number(courseId) && record.date === date)
      );
      const updated = roster.map((student, index) => ({
        id: Date.now() + index,
        course_id: Number(courseId),
        student_id: student.student_id,
        date,
        status: "Present" as AttendanceStatus,
      }));
      return { ...previous, attendance: [...others, ...updated] };
    });
    toast.success("Marked the roster present");
  };

  return (
    <div className="space-y-6">
      <section>
        <span className="badge border-accent/40 bg-accent/15 text-accent">
          Monitoring
        </span>
        <h1 className="mt-3 text-2xl font-bold text-gray-100">Attendance Monitoring</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Review and override daily attendance per course. Missing entries default to
          absent in this temporary preview.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        <GlassSelect
          label="Course"
          value={courseId}
          onChange={(event) => setCourseId(event.target.value)}
        >
          {data.courses.length === 0 ? <option value="">No courses</option> : null}
          {data.courses.map((item) => (
            <option key={item.course_id} value={item.course_id}>
              {item.course_code} — {item.section_name ?? "No section"}
            </option>
          ))}
        </GlassSelect>
        <GlassInput
          label="Date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <div className="flex items-end">
          <button
            type="button"
            onClick={markAllPresent}
            disabled={roster.length === 0}
            className="btn-accent w-full"
          >
            <CheckCheck size={16} />
            Mark all present
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {summary.map((item) => (
          <div key={item.status} className="glass bg-white/10 p-4">
            <p className="text-xs text-gray-400">{item.status}</p>
            <p className="mt-1 text-2xl font-bold text-gray-100">{item.count}</p>
            <span className={clsx("badge mt-2", statusClass[item.status])}>
              {course?.course_code ?? "Course"}
            </span>
          </div>
        ))}
      </div>

      <div className="glass overflow-hidden bg-white/10 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-semibold">Student number</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Section</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {roster.length > 0 ? (
                roster.map((student) => {
                  const status = statusFor(student.student_id);
                  return (
                    <tr
                      key={student.student_id}
                      className="border-b border-white/10 transition hover:bg-white/5 last:border-b-0"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-accent">
                        {student.student_number}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-100">
                        {student.full_name}
                      </td>
                      <td className="px-4 py-3 text-gray-400">{student.section}</td>
                      <td className="px-4 py-3">
                        <select
                          value={status}
                          onChange={(event) =>
                            setStatus(student.student_id, event.target.value as AttendanceStatus)
                          }
                          aria-label={`Attendance status for ${student.full_name}`}
                          className={clsx(
                            "rounded-lg border bg-slate-900/60 px-2.5 py-1.5 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-accent/40",
                            statusClass[status]
                          )}
                        >
                          {STATUSES.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <Users size={22} className="mx-auto text-gray-500" />
                    <p className="mt-2 text-sm text-gray-300">
                      No students in this course section
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="flex items-center gap-2 text-xs text-gray-500">
        <ClipboardCheck size={14} />
        Showing {roster.length} student(s) for {course?.course_code ?? "the selected course"} on {date}.
      </p>
    </div>
  );
}
