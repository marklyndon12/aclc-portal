import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCheck, ScanLine, Users } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import ScannerModal from "../../components/ScannerModal";
import ClassSelect, { LoadState, NoClasses } from "../../components/teacher/ClassSelect";
import { GlassInput } from "../../components/ui/FormControls";
import { api, ApiError } from "../../lib/api";
import { localDate } from "../../lib/dates";
import { useClassSelection, useTeacherOverview } from "../../hooks/useTeacherOverview";
import type { ClassAttendanceRow, StudentAttendanceStatus } from "../../types";

const STATUSES: StudentAttendanceStatus[] = ["Present", "Late", "Absent", "Excused"];

const statusClass: Record<StudentAttendanceStatus, string> = {
  Present: "border-green-400/30 bg-green-400/10 text-green-300",
  Late: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  Absent: "border-red-400/30 bg-red-400/10 text-red-300",
  Excused: "border-sky-400/30 bg-sky-400/10 text-sky-300",
};

export default function TeacherAttendance() {
  const overview = useTeacherOverview();
  const classes = overview.data?.classes ?? [];
  const { selected, select } = useClassSelection(classes);
  const classId = selected?.class_id ?? null;

  const [date, setDate] = useState(localDate);
  const [rows, setRows] = useState<ClassAttendanceRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const load = useCallback(async () => {
    if (classId === null) {
      setRows([]);
      return;
    }
    setLoadingRows(true);
    try {
      const result = await api.get<{ students: ClassAttendanceRow[] }>(
        `/api/teacher/classes/${classId}/attendance?date=${date}`
      );
      setRows(result.students);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load attendance");
    } finally {
      setLoadingRows(false);
    }
  }, [classId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (records: { student_id: number; status: StudentAttendanceStatus }[]) => {
    if (classId === null) return false;
    try {
      await api.put(`/api/teacher/classes/${classId}/attendance`, { date, records });
      setRows((previous) =>
        previous.map((row) => {
          const match = records.find((record) => record.student_id === row.student_id);
          return match ? { ...row, status: match.status } : row;
        })
      );
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save attendance");
      void load();
      return false;
    }
  };

  const markAllPresent = async () => {
    const pending = rows.filter((row) => row.status === null);
    if (pending.length === 0) {
      toast.info("Every student already has a record for this date");
      return;
    }
    const ok = await save(pending.map((row) => ({ student_id: row.student_id, status: "Present" })));
    if (ok) toast.success(`Marked ${pending.length} student(s) present`);
  };

  const summary = useMemo(
    () => [
      ...STATUSES.map((status) => ({
        label: status as string,
        count: rows.filter((row) => row.status === status).length,
        tone: statusClass[status],
      })),
      {
        label: "Not recorded",
        count: rows.filter((row) => row.status === null).length,
        tone: "border-white/15 bg-white/5 text-gray-300",
      },
    ],
    [rows]
  );

  return (
    <div className="space-y-6">
      <section>
        <span className="badge border-accent/40 bg-accent/15 text-accent">Attendance</span>
        <h1 className="mt-3 text-2xl font-bold text-gray-100">Student Attendance</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Scan a student&apos;s live QR or set their status by hand. Changes save right away.
        </p>
      </section>

      <LoadState loading={overview.loading} error={overview.error} onRetry={overview.refresh} />

      {!overview.loading && !overview.error && classes.length === 0 ? <NoClasses /> : null}

      {classes.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_auto_auto]">
            <ClassSelect classes={classes} value={classId} onChange={select} />
            <GlassInput
              label="Date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <div className="flex items-end">
              <button type="button" onClick={markAllPresent} className="btn-glass w-full">
                <CheckCheck size={16} />
                Mark unrecorded present
              </button>
            </div>
            <div className="flex items-end">
              <button type="button" onClick={() => setScannerOpen(true)} className="btn-accent w-full">
                <ScanLine size={16} />
                Scan QR
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {summary.map((item) => (
              <div key={item.label} className="glass bg-white/10 p-4">
                <p className="text-xs text-gray-400">{item.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-100">{item.count}</p>
                <span className={clsx("badge mt-2", item.tone)}>{selected?.subject_code}</span>
              </div>
            ))}
          </div>

          <div className="glass overflow-hidden bg-white/10 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3 font-semibold">Student no.</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length > 0 ? (
                    rows.map((row) => (
                      <tr
                        key={row.student_id}
                        className="border-b border-white/10 transition hover:bg-white/5 last:border-b-0"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-accent">
                          {row.student_number}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-100">{row.full_name}</td>
                        <td className="px-4 py-3">
                          <select
                            value={row.status ?? ""}
                            onChange={(event) =>
                              save([
                                {
                                  student_id: row.student_id,
                                  status: event.target.value as StudentAttendanceStatus,
                                },
                              ])
                            }
                            aria-label={`Attendance status for ${row.full_name}`}
                            className={clsx(
                              "rounded-lg border bg-slate-900/60 px-2.5 py-1.5 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-accent/40",
                              row.status ? statusClass[row.status] : "border-white/15 text-gray-400"
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
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center">
                        <Users size={22} className="mx-auto text-gray-500" />
                        <p className="mt-2 text-sm text-gray-300">
                          {loadingRows ? "Loading…" : "No students are enrolled in this section yet"}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      <ScannerModal
        open={scannerOpen}
        course={selected}
        onClose={() => {
          setScannerOpen(false);
          void load();
        }}
        onScanned={() => void load()}
      />
    </div>
  );
}
