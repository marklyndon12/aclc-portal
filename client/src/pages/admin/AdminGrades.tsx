import { useMemo, useState } from "react";
import { Award, GraduationCap } from "lucide-react";
import clsx from "clsx";
import { GlassSelect } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import type { GradeRecord } from "../../types";

type TermKey = "prelim" | "midterm" | "prefinal" | "final";

const TERMS: { key: TermKey; label: string }[] = [
  { key: "prelim", label: "Prelim" },
  { key: "midterm", label: "Midterm" },
  { key: "prefinal", label: "Pre-final" },
  { key: "final", label: "Final" },
];

const emptyGrade: Omit<GradeRecord, "id" | "course_id" | "student_id"> = {
  prelim: null,
  midterm: null,
  prefinal: null,
  final: null,
};

function averageOf(record: GradeRecord | undefined): number | null {
  if (!record) return null;
  const values = TERMS.map((term) => record[term.key]).filter(
    (value): value is number => typeof value === "number"
  );
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function remarksFor(average: number | null): "Passed" | "Failed" | "Pending" {
  if (average === null) return "Pending";
  return average >= 75 ? "Passed" : "Failed";
}

export default function AdminGrades() {
  const { data, setData } = useAdminData();
  const [courseId, setCourseId] = useState(() => String(data.courses[0]?.course_id ?? ""));

  const course = data.courses.find((item) => item.course_id === Number(courseId));
  const roster = useMemo(() => {
    if (!course?.section_name) return data.students;
    return data.students.filter((student) => student.section === course.section_name);
  }, [course, data.students]);

  const gradeFor = (studentId: number) =>
    data.grades.find(
      (record) => record.course_id === Number(courseId) && record.student_id === studentId
    );

  const averages = roster
    .map((student) => averageOf(gradeFor(student.student_id)))
    .filter((value): value is number => value !== null);
  const classAverage =
    averages.length > 0
      ? Math.round((averages.reduce((sum, value) => sum + value, 0) / averages.length) * 10) / 10
      : null;
  const passing = averages.filter((value) => value >= 75).length;

  const updateGrade = (studentId: number, term: TermKey, raw: string) => {
    let value: number | null = null;
    if (raw.trim() !== "") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        value = Math.min(100, Math.max(0, parsed));
      }
    }

    setData((previous) => {
      const existing = previous.grades.find(
        (record) =>
          record.course_id === Number(courseId) && record.student_id === studentId
      );

      if (existing) {
        return {
          ...previous,
          grades: previous.grades.map((record) =>
            record.id === existing.id ? { ...record, [term]: value } : record
          ),
        };
      }

      return {
        ...previous,
        grades: [
          ...previous.grades,
          {
            id: Date.now() + studentId,
            course_id: Number(courseId),
            student_id: studentId,
            ...emptyGrade,
            [term]: value,
          },
        ],
      };
    });
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge border-accent/40 bg-accent/15 text-accent">
            Oversight
          </span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100">Grade Oversight</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Review and override term grades. Averages use non-null terms; passing mark is
            75. Changes save automatically to this browser.
          </p>
        </div>
        <div className="w-full sm:w-72">
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
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="glass bg-white/10 p-4">
          <p className="text-xs text-gray-400">Class average</p>
          <p className="mt-1 text-2xl font-bold text-gray-100">
            {classAverage ?? "—"}
          </p>
        </div>
        <div className="glass bg-white/10 p-4">
          <p className="text-xs text-gray-400">Passing</p>
          <p className="mt-1 text-2xl font-bold text-green-400">
            {passing}/{roster.length}
          </p>
        </div>
        <div className="glass bg-white/10 p-4">
          <p className="text-xs text-gray-400">Needs attention</p>
          <p className="mt-1 text-2xl font-bold text-amber-400">
            {averages.filter((value) => value < 75).length}
          </p>
        </div>
      </div>

      <div className="glass overflow-hidden bg-white/10 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-semibold">Student</th>
                {TERMS.map((term) => (
                  <th key={term.key} className="px-3 py-3 font-semibold">
                    {term.label}
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold">Average</th>
                <th className="px-4 py-3 font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {roster.length > 0 ? (
                roster.map((student) => {
                  const record = gradeFor(student.student_id);
                  const average = averageOf(record);
                  const remarks = remarksFor(average);

                  return (
                    <tr
                      key={student.student_id}
                      className="border-b border-white/10 transition hover:bg-white/5 last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-100">{student.full_name}</p>
                        <p className="text-xs text-gray-500">{student.student_number}</p>
                      </td>
                      {TERMS.map((term) => (
                        <td key={term.key} className="px-3 py-3">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={record?.[term.key] ?? ""}
                            onChange={(event) =>
                              updateGrade(student.student_id, term.key, event.target.value)
                            }
                            aria-label={`${term.label} grade for ${student.full_name}`}
                            placeholder="—"
                            className="w-20 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-gray-100 outline-none transition placeholder:text-gray-600 focus:border-accent focus:ring-2 focus:ring-accent/40"
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3 font-semibold text-gray-100">
                        {average === null ? "—" : average.toFixed(1)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            "badge",
                            remarks === "Passed"
                              ? "border-green-400/30 bg-green-400/10 text-green-300"
                              : remarks === "Failed"
                                ? "border-red-400/30 bg-red-400/10 text-red-300"
                                : "border-gray-400/30 bg-gray-400/10 text-gray-300"
                          )}
                        >
                          {remarks}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <GraduationCap size={22} className="mx-auto text-gray-500" />
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
        <Award size={14} />
        {course ? `${course.course_code} · ${course.course_name}` : "Select a course"} ·{" "}
        {roster.length} student(s)
      </p>
    </div>
  );
}
