import { Award } from "lucide-react";
import clsx from "clsx";
import LoadState from "../../components/LoadState";
import { useStudentData } from "../../hooks/useStudentOverview";
import type { StudentGradeRow } from "../../types";

const fmt = (value: number | null, digits = 0) =>
  value === null ? "—" : digits > 0 ? value.toFixed(digits) : String(value);

export default function StudentGrades() {
  const { data, loading, error, refresh } = useStudentData<{
    grades: StudentGradeRow[];
    gwa: number | null;
  }>("/api/student/grades");
  const grades = data?.grades ?? [];
  const graded = grades.filter((row) => row.grade_value !== null);
  const passed = graded.filter((row) => (row.grade_value ?? 0) >= 75).length;

  return (
    <div className="space-y-6">
      <section>
        <span className="badge border-accent/40 bg-accent/15 text-accent">Academics</span>
        <h1 className="mt-3 text-2xl font-bold text-gray-100">My Grades</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Your term grades per subject. Passing is 75 and above; a lower GPA number is better.
        </p>
      </section>

      <LoadState loading={loading} error={error} onRetry={refresh} />

      {!loading && !error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="glass bg-white/10 p-4">
              <p className="text-xs text-gray-400">General weighted average</p>
              <p className="mt-1 text-2xl font-bold text-gray-100">{fmt(data?.gwa ?? null, 2)}</p>
              <p className="text-[11px] text-gray-500">weighted by units</p>
            </div>
            <div className="glass bg-white/10 p-4">
              <p className="text-xs text-gray-400">Subjects graded</p>
              <p className="mt-1 text-2xl font-bold text-gray-100">
                {graded.length} <span className="text-sm font-normal text-gray-500">of {grades.length}</span>
              </p>
            </div>
            <div className="glass bg-white/10 p-4">
              <p className="text-xs text-gray-400">Passed</p>
              <p className="mt-1 text-2xl font-bold text-green-400">{passed}</p>
            </div>
          </div>

          <div className="glass overflow-hidden bg-white/10 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3 font-semibold">Subject</th>
                    <th className="px-3 py-3 font-semibold">Prelim</th>
                    <th className="px-3 py-3 font-semibold">Midterm</th>
                    <th className="px-3 py-3 font-semibold">Pre-final</th>
                    <th className="px-3 py-3 font-semibold">Final</th>
                    <th className="px-3 py-3 font-semibold">Average</th>
                    <th className="px-3 py-3 font-semibold">GPA</th>
                    <th className="px-3 py-3 font-semibold">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.length > 0 ? (
                    grades.map((row) => {
                      const passedRow = (row.grade_value ?? 0) >= 75;
                      return (
                        <tr
                          key={row.class_id}
                          className="border-b border-white/10 transition hover:bg-white/5 last:border-b-0"
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-100">{row.subject_name}</p>
                            <p className="text-xs text-gray-500">
                              {row.subject_code} · {row.units} units · {row.teacher_name ?? "No teacher"}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-gray-300">{fmt(row.prelim)}</td>
                          <td className="px-3 py-3 text-gray-300">{fmt(row.midterm)}</td>
                          <td className="px-3 py-3 text-gray-300">{fmt(row.prefinal)}</td>
                          <td className="px-3 py-3 text-gray-300">{fmt(row.final)}</td>
                          <td className="px-3 py-3 font-semibold text-gray-100">{fmt(row.grade_value, 2)}</td>
                          <td className="px-3 py-3 text-gray-300">{fmt(row.gpa, 2)}</td>
                          <td className="px-3 py-3">
                            {row.grade_value === null ? (
                              <span className="badge border-white/15 bg-white/5 text-gray-400">Not graded</span>
                            ) : (
                              <span
                                className={clsx(
                                  "badge",
                                  passedRow
                                    ? "border-green-400/30 bg-green-400/10 text-green-300"
                                    : "border-red-400/30 bg-red-400/10 text-red-300"
                                )}
                              >
                                {passedRow ? "Passed" : "Failed"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <Award size={22} className="mx-auto text-gray-500" />
                        <p className="mt-2 text-sm text-gray-300">No subjects yet</p>
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
