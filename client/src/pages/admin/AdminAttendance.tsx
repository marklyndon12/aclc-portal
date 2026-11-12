import { useMemo, useState } from "react";
import { CheckCheck, ClipboardCheck, Search, Users } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { GlassInput } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import { api, ApiError } from "../../lib/api";
import type { AdminDataState } from "../../data/adminSeed";
import type { TeacherAttendanceRecord, TeacherAttendanceStatus } from "../../types";

const STATUSES: TeacherAttendanceStatus[] = ["Present", "On Leave", "Absent"];

const statusClass: Record<TeacherAttendanceStatus, string> = {
  Present: "border-green-400/30 bg-green-400/10 text-green-300",
  "On Leave": "border-sky-400/30 bg-sky-400/10 text-sky-300",
  Absent: "border-red-400/30 bg-red-400/10 text-red-300",
};

// Times may be stored as "07:45 AM" (older rows) or "07:45"; <input type="time"> needs 24h HH:MM.
function toInputTime(value: string | null): string {
  if (!value) return "";
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return "";
  let hours = Number(match[1]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

type RemoteData = Omit<AdminDataState, "version">;

export default function AdminAttendance() {
  const { data, replaceData } = useAdminData();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const recordByTeacher = useMemo(() => {
    const map = new Map<number, TeacherAttendanceRecord>();
    for (const record of data.teacherAttendance) {
      if (record.date === date) map.set(record.teacher_id, record);
    }
    return map;
  }, [data.teacherAttendance, date]);

  const teachers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.teachers.filter(
      (teacher) =>
        !term ||
        teacher.full_name.toLowerCase().includes(term) ||
        teacher.department.toLowerCase().includes(term)
    );
  }, [data.teachers, query]);

  const summary = [
    ...STATUSES.map((status) => ({
      label: status as string,
      count: data.teachers.filter((t) => recordByTeacher.get(t.teacher_id)?.status === status)
        .length,
      tone: statusClass[status],
    })),
    {
      label: "Not recorded",
      count: data.teachers.filter((t) => !recordByTeacher.has(t.teacher_id)).length,
      tone: "border-white/15 bg-white/5 text-gray-300",
    },
  ];

  const save = async (
    teacherId: number,
    status: TeacherAttendanceStatus,
    timeIn: string,
    timeOut: string
  ) => {
    try {
      const remote = await api.put<RemoteData>("/api/admin/teacher-attendance", {
        teacher_id: teacherId,
        date,
        status,
        time_in: timeIn || null,
        time_out: timeOut || null,
      });
      replaceData(remote);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save attendance");
    }
  };

  const markAllPresent = async () => {
    const pending = data.teachers.filter((t) => !recordByTeacher.has(t.teacher_id));
    if (pending.length === 0) {
      toast.info("Every teacher already has a record for this date");
      return;
    }
    setBusy(true);
    for (const teacher of pending) {
      await save(teacher.teacher_id, "Present", "", "");
    }
    setBusy(false);
    toast.success(`Marked ${pending.length} teacher(s) present`);
  };

  return (
    <div className="space-y-6">
      <section>
        <span className="badge border-accent/40 bg-accent/15 text-accent">Monitoring</span>
        <h1 className="mt-3 text-2xl font-bold text-gray-100">Teacher Attendance</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Record and review daily attendance for faculty. Student attendance is handled
          by teachers in their own portal.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        <GlassInput
          label="Date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Search
          </span>
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Teacher or department"
              aria-label="Search teachers"
              className="input-glass pl-9"
            />
          </div>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={markAllPresent}
            disabled={busy || data.teachers.length === 0}
            className="btn-accent w-full"
          >
            <CheckCheck size={16} />
            Mark unrecorded present
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="glass bg-white/10 p-4">
            <p className="text-xs text-gray-400">{item.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-100">{item.count}</p>
            <span className={clsx("badge mt-2", item.tone)}>{date}</span>
          </div>
        ))}
      </div>

      <div className="glass overflow-hidden bg-white/10 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-semibold">Teacher</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Time in</th>
                <th className="px-4 py-3 font-semibold">Time out</th>
              </tr>
            </thead>
            <tbody>
              {teachers.length > 0 ? (
                teachers.map((teacher) => {
                  const record = recordByTeacher.get(teacher.teacher_id);
                  const status = record?.status ?? "";
                  const present = record?.status === "Present";
                  const timeIn = toInputTime(record?.time_in ?? null);
                  const timeOut = toInputTime(record?.time_out ?? null);
                  // key forces the uncontrolled time inputs to reset after a save/refetch
                  const key = `${teacher.teacher_id}-${date}-${record?.id ?? "new"}-${timeIn}-${timeOut}-${status}`;
                  return (
                    <tr
                      key={key}
                      className="border-b border-white/10 transition hover:bg-white/5 last:border-b-0"
                    >
                      <td className="px-4 py-3 font-medium text-gray-100">
                        {teacher.full_name}
                      </td>
                      <td className="px-4 py-3 text-gray-400">{teacher.department}</td>
                      <td className="px-4 py-3">
                        <select
                          value={status}
                          onChange={(event) =>
                            save(
                              teacher.teacher_id,
                              event.target.value as TeacherAttendanceStatus,
                              timeIn,
                              timeOut
                            )
                          }
                          aria-label={`Attendance status for ${teacher.full_name}`}
                          className={clsx(
                            "rounded-lg border bg-slate-900/60 px-2.5 py-1.5 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-accent/40",
                            status
                              ? statusClass[status as TeacherAttendanceStatus]
                              : "border-white/15 text-gray-400"
                          )}
                        >
                          <option value="" disabled>
                            Not recorded
                          </option>
                          {STATUSES.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      {(["in", "out"] as const).map((kind) => (
                        <td key={kind} className="px-4 py-3">
                          <input
                            type="time"
                            defaultValue={kind === "in" ? timeIn : timeOut}
                            disabled={!present}
                            aria-label={`Time ${kind} for ${teacher.full_name}`}
                            onBlur={(event) => {
                              const next = event.target.value;
                              if (next === (kind === "in" ? timeIn : timeOut)) return;
                              void save(
                                teacher.teacher_id,
                                "Present",
                                kind === "in" ? next : timeIn,
                                kind === "out" ? next : timeOut
                              );
                            }}
                            className="rounded-lg border border-white/15 bg-slate-900/60 px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Users size={22} className="mx-auto text-gray-500" />
                    <p className="mt-2 text-sm text-gray-300">
                      {data.teachers.length === 0
                        ? "No teachers yet. Add teachers first."
                        : "No teachers match your search"}
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
        Time in/out can be set once a teacher is marked present.
      </p>
    </div>
  );
}
