import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import clsx from "clsx";
import { LoadState } from "../../components/teacher/ClassSelect";
import { api, ApiError } from "../../lib/api";
import { formatDate, formatTime } from "../../lib/dates";
import type { TeacherAttendanceStatus, TeacherLogRecord } from "../../types";

const statusClass: Record<TeacherAttendanceStatus, string> = {
  Present: "border-green-400/30 bg-green-400/10 text-green-300",
  "On Leave": "border-sky-400/30 bg-sky-400/10 text-sky-300",
  Absent: "border-red-400/30 bg-red-400/10 text-red-300",
};

export default function TeacherMyAttendance() {
  const [records, setRecords] = useState<TeacherLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.get<{ records: TeacherLogRecord[] }>("/api/teacher/my-attendance");
      setRecords(result.records);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your attendance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(
    () =>
      (["Present", "On Leave", "Absent"] as TeacherAttendanceStatus[]).map((status) => ({
        status,
        count: records.filter((record) => record.status === status).length,
      })),
    [records]
  );

  return (
    <div className="space-y-6">
      <section>
        <span className="badge border-accent/40 bg-accent/15 text-accent">Records</span>
        <h1 className="mt-3 text-2xl font-bold text-gray-100">My Attendance</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Your own attendance as recorded by the admin office.
        </p>
      </section>

      <LoadState loading={loading} error={error} onRetry={load} />

      {!loading && !error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {summary.map((item) => (
              <div key={item.status} className="glass bg-white/10 p-4">
                <p className="text-xs text-gray-400">{item.status}</p>
                <p className="mt-1 text-2xl font-bold text-gray-100">{item.count}</p>
                <span className={clsx("badge mt-2", statusClass[item.status])}>days</span>
              </div>
            ))}
          </div>

          <div className="glass overflow-hidden bg-white/10 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Time in</th>
                    <th className="px-4 py-3 font-semibold">Time out</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length > 0 ? (
                    records.map((record) => (
                      <tr
                        key={record.id}
                        className="border-b border-white/10 transition hover:bg-white/5 last:border-b-0"
                      >
                        <td className="px-4 py-3 text-gray-100">{formatDate(record.date)}</td>
                        <td className="px-4 py-3">
                          <span className={clsx("badge", statusClass[record.status])}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{formatTime(record.time_in)}</td>
                        <td className="px-4 py-3 text-gray-400">{formatTime(record.time_out)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center">
                        <Clock size={22} className="mx-auto text-gray-500" />
                        <p className="mt-2 text-sm text-gray-300">No attendance recorded yet</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
