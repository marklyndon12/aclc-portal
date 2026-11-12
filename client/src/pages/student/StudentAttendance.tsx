import { ClipboardCheck } from "lucide-react";
import clsx from "clsx";
import LoadState from "../../components/LoadState";
import { useStudentData } from "../../hooks/useStudentOverview";
import { formatDate } from "../../lib/dates";
import type { StudentAttendanceRecord, StudentAttendanceSummary } from "../../types";

const statusClass: Record<string, string> = {
  Present: "border-green-400/30 bg-green-400/10 text-green-300",
  Late: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  Absent: "border-red-400/30 bg-red-400/10 text-red-300",
  Excused: "border-sky-400/30 bg-sky-400/10 text-sky-300",
};

export default function StudentAttendance() {
  const { data, loading, error, refresh } = useStudentData<{
    summary: StudentAttendanceSummary[];
    records: StudentAttendanceRecord[];
  }>("/api/student/attendance");
  const summary = data?.summary ?? [];
  const records = data?.records ?? [];

  const totals = {
    present: summary.reduce((sum, row) => sum + row.present, 0),
    late: summary.reduce((sum, row) => sum + row.late, 0),
    absent: summary.reduce((sum, row) => sum + row.absent, 0),
    excused: summary.reduce((sum, row) => sum + row.excused, 0),
  };

  return (
    <div className="space-y-6">
      <section>
        <span className="badge border-accent/40 bg-accent/15 text-accent">Attendance</span>
        <h1 className="mt-3 text-2xl font-bold text-gray-100">My Attendance</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Recorded by your teachers when they scan your live ID or mark you by hand.
        </p>
      </section>

      <LoadState loading={loading} error={error} onRetry={refresh} />

      {!loading && !error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(totals) as (keyof typeof totals)[]).map((key) => {
              const label = key[0].toUpperCase() + key.slice(1);
              return (
                <div key={key} className="glass bg-white/10 p-4">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-100">{totals[key]}</p>
                  <span className={clsx("badge mt-2", statusClass[label])}>total</span>
                </div>
              );
            })}
          </div>

          <div className="glass overflow-hidden bg-white/10 shadow-lg">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-100">By subject</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3 font-semibold">Subject</th>
                    <th className="px-3 py-3 font-semibold">Present</th>
                    <th className="px-3 py-3 font-semibold">Late</th>
                    <th className="px-3 py-3 font-semibold">Absent</th>
                    <th className="px-3 py-3 font-semibold">Excused</th>
                    <th className="px-3 py-3 font-semibold">Attendance rate</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.length > 0 ? (
                    summary.map((row) => (
                      <tr key={row.class_id} className="border-b border-white/10 last:border-b-0">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-100">{row.subject_name}</p>
                          <p className="text-xs text-gray-500">{row.subject_code}</p>
                        </td>
                        <td className="px-3 py-3 text-gray-300">{row.present}</td>
                        <td className="px-3 py-3 text-gray-300">{row.late}</td>
                        <td className="px-3 py-3 text-gray-300">{row.absent}</td>
                        <td className="px-3 py-3 text-gray-300">{row.excused}</td>
                        <td className="px-3 py-3">
                          {row.rate === null ? (
                            <span className="text-gray-500">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                                <div
                                  className={clsx(
                                    "h-full rounded-full",
                                    row.rate >= 80 ? "bg-green-400" : row.rate >= 60 ? "bg-amber-400" : "bg-red-400"
                                  )}
                                  style={{ width: `${row.rate}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-300">{row.rate}%</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                        No subjects yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass overflow-hidden bg-white/10 shadow-lg">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-100">Recent records</h2>
            </div>
            {records.length > 0 ? (
              <ul className="divide-y divide-white/10">
                {records.map((record) => (
                  <li key={record.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-100">{record.subject_name}</p>
                      <p className="text-xs text-gray-500">
                        {record.subject_code} · {formatDate(record.date)}
                      </p>
                    </div>
                    <span className={clsx("badge", statusClass[record.status])}>{record.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-10 text-center">
                <ClipboardCheck size={22} className="mx-auto text-gray-500" />
                <p className="mt-2 text-sm text-gray-300">No attendance recorded yet</p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
