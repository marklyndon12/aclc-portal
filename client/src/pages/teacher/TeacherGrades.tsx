import { useCallback, useEffect, useState } from "react";
import { Award, Save } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import ClassSelect, { LoadState, NoClasses } from "../../components/teacher/ClassSelect";
import { api, ApiError } from "../../lib/api";
import { useClassSelection, useTeacherOverview } from "../../hooks/useTeacherOverview";
import type { ClassGradeRow } from "../../types";

const TERMS = ["prelim", "midterm", "prefinal", "final"] as const;
type Term = (typeof TERMS)[number];
type Draft = Record<Term, string>;

const TERM_LABEL: Record<Term, string> = {
  prelim: "Prelim",
  midterm: "Midterm",
  prefinal: "Pre-final",
  final: "Final",
};

function gpaFor(average: number): number {
  if (average >= 97) return 1;
  if (average >= 94) return 1.25;
  if (average >= 91) return 1.5;
  if (average >= 88) return 1.75;
  if (average >= 85) return 2;
  if (average >= 82) return 2.25;
  if (average >= 79) return 2.5;
  if (average >= 76) return 2.75;
  if (average >= 75) return 3;
  return 5;
}

const toDraft = (row: ClassGradeRow): Draft => ({
  prelim: row.prelim === null ? "" : String(row.prelim),
  midterm: row.midterm === null ? "" : String(row.midterm),
  prefinal: row.prefinal === null ? "" : String(row.prefinal),
  final: row.final === null ? "" : String(row.final),
});

function averageOf(draft: Draft): number | null {
  const values = TERMS.map((term) => draft[term]).filter((value) => value.trim() !== "").map(Number);
  if (values.length === 0 || values.some((value) => Number.isNaN(value))) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default function TeacherGrades() {
  const overview = useTeacherOverview();
  const classes = overview.data?.classes ?? [];
  const { selected, select } = useClassSelection(classes);
  const classId = selected?.class_id ?? null;

  const [rows, setRows] = useState<ClassGradeRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [loadingRows, setLoadingRows] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (classId === null) {
      setRows([]);
      setDrafts({});
      return;
    }
    setLoadingRows(true);
    try {
      const result = await api.get<{ students: ClassGradeRow[] }>(
        `/api/teacher/classes/${classId}/grades`
      );
      setRows(result.students);
      setDrafts(Object.fromEntries(result.students.map((row) => [row.student_id, toDraft(row)])));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load grades");
    } finally {
      setLoadingRows(false);
    }
  }, [classId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isDirty = (row: ClassGradeRow) => {
    const draft = drafts[row.student_id];
    if (!draft) return false;
    const saved = toDraft(row);
    return TERMS.some((term) => draft[term] !== saved[term]);
  };

  const invalid = (draft: Draft) =>
    TERMS.some((term) => {
      if (draft[term].trim() === "") return false;
      const value = Number(draft[term]);
      return Number.isNaN(value) || value < 0 || value > 100;
    });

  const saveRow = async (row: ClassGradeRow): Promise<boolean> => {
    const draft = drafts[row.student_id];
    if (!draft || classId === null) return false;
    if (invalid(draft)) {
      toast.error(`${row.full_name}: grades must be between 0 and 100`);
      return false;
    }
    setSavingId(row.student_id);
    try {
      const payload = {
        student_id: row.student_id,
        ...Object.fromEntries(
          TERMS.map((term) => [term, draft[term].trim() === "" ? null : Number(draft[term])])
        ),
      };
      const result = await api.put<{ gpa: number | null; remarks: string }>(
        `/api/teacher/classes/${classId}/grades`,
        payload
      );
      setRows((previous) =>
        previous.map((item) =>
          item.student_id === row.student_id
            ? {
                ...item,
                ...(Object.fromEntries(
                  TERMS.map((term) => [term, draft[term].trim() === "" ? null : Number(draft[term])])
                ) as Pick<ClassGradeRow, Term>),
                gpa: result.gpa,
                remarks: result.remarks,
              }
            : item
        )
      );
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save grade");
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const saveAll = async () => {
    const dirty = rows.filter(isDirty);
    if (dirty.length === 0) {
      toast.info("No changes to save");
      return;
    }
    let saved = 0;
    for (const row of dirty) {
      if (await saveRow(row)) saved += 1;
    }
    if (saved > 0) toast.success(`Saved ${saved} grade${saved === 1 ? "" : "s"}`);
  };

  const dirtyCount = rows.filter(isDirty).length;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge border-accent/40 bg-accent/15 text-accent">Grading</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100">Grade Management</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Enter each term&apos;s grade (0–100). The average, GPA and remarks are
            computed for you. Passing is 75 and above.
          </p>
        </div>
        <button
          type="button"
          onClick={saveAll}
          disabled={dirtyCount === 0 || savingId !== null}
          className="btn-accent"
        >
          <Save size={16} />
          Save all{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
        </button>
      </section>

      <LoadState loading={overview.loading} error={overview.error} onRetry={overview.refresh} />

      {!overview.loading && !overview.error && classes.length === 0 ? <NoClasses /> : null}

      {classes.length > 0 ? (
        <>
          <div className="max-w-xl">
            <ClassSelect classes={classes} value={classId} onChange={select} />
          </div>

          <div className="glass overflow-hidden bg-white/10 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3 font-semibold">Student</th>
                    {TERMS.map((term) => (
                      <th key={term} className="px-2 py-3 font-semibold">
                        {TERM_LABEL[term]}
                      </th>
                    ))}
                    <th className="px-3 py-3 font-semibold">Avg</th>
                    <th className="px-3 py-3 font-semibold">GPA</th>
                    <th className="px-3 py-3 font-semibold">Remarks</th>
                    <th className="px-3 py-3 text-right font-semibold">Save</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length > 0 ? (
                    rows.map((row) => {
                      const draft = drafts[row.student_id] ?? toDraft(row);
                      const average = averageOf(draft);
                      const dirty = isDirty(row);
                      return (
                        <tr
                          key={row.student_id}
                          className="border-b border-white/10 transition hover:bg-white/5 last:border-b-0"
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-100">{row.full_name}</p>
                            <p className="font-mono text-[11px] text-gray-500">{row.student_number}</p>
                          </td>
                          {TERMS.map((term) => (
                            <td key={term} className="px-2 py-3">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={draft[term]}
                                onChange={(event) =>
                                  setDrafts((previous) => ({
                                    ...previous,
                                    [row.student_id]: { ...draft, [term]: event.target.value },
                                  }))
                                }
                                aria-label={`${TERM_LABEL[term]} grade for ${row.full_name}`}
                                className="w-20 rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-accent/40"
                              />
                            </td>
                          ))}
                          <td className="px-3 py-3 text-gray-300">
                            {average === null ? "—" : average.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-gray-300">
                            {average === null ? "—" : gpaFor(average).toFixed(2)}
                          </td>
                          <td className="px-3 py-3">
                            {average === null ? (
                              <span className="badge border-white/15 bg-white/5 text-gray-400">N/A</span>
                            ) : (
                              <span
                                className={clsx(
                                  "badge",
                                  average >= 75
                                    ? "border-green-400/30 bg-green-400/10 text-green-300"
                                    : "border-red-400/30 bg-red-400/10 text-red-300"
                                )}
                              >
                                {average >= 75 ? "Passed" : "Failed"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={async () => {
                                if (await saveRow(row)) toast.success(`Saved ${row.full_name}`);
                              }}
                              disabled={!dirty || savingId === row.student_id}
                              className="btn-glass text-xs disabled:opacity-40"
                            >
                              {savingId === row.student_id ? "Saving…" : "Save"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center">
                        <Award size={22} className="mx-auto text-gray-500" />
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
    </div>
  );
}
