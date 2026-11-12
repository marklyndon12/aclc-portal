import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FileQuestion, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import Modal from "../../components/Modal";
import LoadState from "../../components/LoadState";
import { GlassInput, GlassSelect, GlassTextarea } from "../../components/ui/FormControls";
import { NoClasses } from "../../components/teacher/ClassSelect";
import { api, ApiError } from "../../lib/api";
import { useTeacherOverview } from "../../hooks/useTeacherOverview";
import type { QuestionType, TeacherQuizItem } from "../../types";

// ───────── Create quiz ─────────

interface QuestionDraft {
  key: number;
  type: QuestionType;
  text: string;
  options: string[];
  correctIndex: number;
  trueFalse: "True" | "False";
  points: string;
}

let nextKey = 1;
const newQuestion = (type: QuestionType = "multiple_choice"): QuestionDraft => ({
  key: nextKey++,
  type,
  text: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  trueFalse: "True",
  points: "1",
});

const TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True / False",
  short_answer: "Short answer (you grade it)",
};

// ───────── Results ─────────

interface QuizDetail {
  quiz: { quiz_id: string; title: string };
  questions: { question_id: string; type: string; text: string; points: number }[];
  submissions: {
    submission_id: string;
    student_name: string;
    student_number: string;
    submitted_at: string;
    total_score: number;
    status: string;
  }[];
}

interface SubmissionDetail {
  submission: { submission_id: string; total_score: number; status: string };
  answers: {
    answer_id: string;
    question_text: string;
    type: string;
    correct_answer: string | null;
    max_points: number;
    student_answer: string;
    is_correct: boolean | null;
    points_awarded: number;
  }[];
}

export default function TeacherQuizzes() {
  const overview = useTeacherOverview();
  const classes = overview.data?.classes ?? [];

  const [quizzes, setQuizzes] = useState<TeacherQuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.get<{ quizzes: TeacherQuizItem[] }>("/api/teacher/quizzes");
      setQuizzes(result.quizzes);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load quizzes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // create form
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [deadline, setDeadline] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([newQuestion()]);

  const openCreate = () => {
    setClassId(String(classes[0]?.class_id ?? ""));
    setTitle("");
    setInstructions("");
    setDeadline("");
    setQuestions([newQuestion()]);
    setCreating(true);
  };

  const patchQuestion = (key: number, patch: Partial<QuestionDraft>) =>
    setQuestions((previous) => previous.map((q) => (q.key === key ? { ...q, ...patch } : q)));

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!classId) {
      toast.error("Choose a class");
      return;
    }
    if (!title.trim()) {
      toast.error("Give the quiz a title");
      return;
    }

    const payloadQuestions = [];
    for (const [index, q] of questions.entries()) {
      const label = `Question ${index + 1}`;
      const points = Number(q.points);
      if (!q.text.trim()) {
        toast.error(`${label}: write the question`);
        return;
      }
      if (!Number.isFinite(points) || points < 0.5 || points > 100) {
        toast.error(`${label}: points must be between 0.5 and 100`);
        return;
      }
      if (q.type === "multiple_choice") {
        const options = q.options.map((option) => option.trim()).filter(Boolean);
        const correct = q.options[q.correctIndex]?.trim();
        if (options.length < 2) {
          toast.error(`${label}: add at least 2 options`);
          return;
        }
        if (!correct) {
          toast.error(`${label}: mark which option is correct (it can't be empty)`);
          return;
        }
        payloadQuestions.push({ type: q.type, text: q.text.trim(), options, correct_answer: correct, points });
      } else if (q.type === "true_false") {
        payloadQuestions.push({ type: q.type, text: q.text.trim(), correct_answer: q.trueFalse, points });
      } else {
        payloadQuestions.push({ type: q.type, text: q.text.trim(), points });
      }
    }

    setSaving(true);
    try {
      await api.post("/api/teacher/quizzes", {
        class_id: Number(classId),
        title: title.trim(),
        instructions: instructions.trim() || null,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        questions: payloadQuestions,
      });
      toast.success("Quiz posted");
      setCreating(false);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create the quiz");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (quiz: TeacherQuizItem) => {
    const note =
      quiz.submission_count > 0
        ? ` This also deletes ${quiz.submission_count} student submission(s).`
        : "";
    if (!window.confirm(`Delete "${quiz.title}"?${note}`)) return;
    try {
      await api.delete(`/api/teacher/quizzes/${quiz.quiz_id}`);
      toast.success("Quiz deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete the quiz");
    }
  };

  // results
  const [detail, setDetail] = useState<QuizDetail | null>(null);
  const [grading, setGrading] = useState<SubmissionDetail | null>(null);
  const [points, setPoints] = useState<Record<string, string>>({});
  const [savingGrade, setSavingGrade] = useState(false);

  const openResults = async (quiz: TeacherQuizItem) => {
    try {
      setDetail(await api.get<QuizDetail>(`/api/teacher/quizzes/${quiz.quiz_id}`));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not open the quiz");
    }
  };

  const openSubmission = async (submissionId: string) => {
    if (!detail) return;
    try {
      const result = await api.get<SubmissionDetail>(
        `/api/teacher/quizzes/${detail.quiz.quiz_id}/submissions/${submissionId}`
      );
      setGrading(result);
      setPoints(Object.fromEntries(result.answers.map((answer) => [answer.answer_id, String(answer.points_awarded)])));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not open the submission");
    }
  };

  const saveGrade = async () => {
    if (!detail || !grading) return;
    const grades = grading.answers
      .filter((answer) => answer.type === "short_answer")
      .map((answer) => ({ answer_id: answer.answer_id, points_awarded: Number(points[answer.answer_id] ?? 0) }));
    if (grades.some((grade) => Number.isNaN(grade.points_awarded) || grade.points_awarded < 0)) {
      toast.error("Points must be 0 or more");
      return;
    }
    setSavingGrade(true);
    try {
      await api.put(
        `/api/teacher/quizzes/${detail.quiz.quiz_id}/submissions/${grading.submission.submission_id}/grade`,
        { grades }
      );
      toast.success("Grade saved");
      setGrading(null);
      setDetail(await api.get<QuizDetail>(`/api/teacher/quizzes/${detail.quiz.quiz_id}`));
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the grade");
    } finally {
      setSavingGrade(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge border-accent/40 bg-accent/15 text-accent">Assessments</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100">Quizzes</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Post quizzes to your classes. Multiple choice and true/false are graded for you;
            short answers wait for your grading.
          </p>
        </div>
        <button type="button" onClick={openCreate} disabled={classes.length === 0} className="btn-accent">
          <Plus size={16} />
          New quiz
        </button>
      </section>

      <LoadState loading={loading || overview.loading} error={error ?? overview.error} onRetry={load} />

      {!overview.loading && !overview.error && classes.length === 0 ? <NoClasses /> : null}

      {!loading && !error && classes.length > 0 && quizzes.length === 0 ? (
        <div className="glass bg-white/10 px-5 py-12 text-center">
          <FileQuestion size={22} className="mx-auto text-gray-500" />
          <p className="mt-2 text-sm text-gray-300">No quizzes yet</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {quizzes.map((quiz) => (
          <article key={quiz.quiz_id} className="glass bg-white/10 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
                  {quiz.subject_code} · {quiz.section_name}
                </p>
                <h2 className="mt-1 text-base font-semibold text-gray-100">{quiz.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(quiz)}
                aria-label={`Delete ${quiz.title}`}
                title="Delete"
                className="icon-btn hover:border-red-400/40 hover:bg-red-500/20 hover:text-red-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {quiz.question_count} question{quiz.question_count === 1 ? "" : "s"} · {quiz.max_score} points ·{" "}
              {quiz.deadline
                ? `Due ${new Date(quiz.deadline).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
                : "No deadline"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="badge border-white/15 bg-white/5 text-gray-300">
                {quiz.submission_count} submitted
              </span>
              {quiz.pending_count > 0 ? (
                <span className="badge border-amber-400/30 bg-amber-400/10 text-amber-300">
                  {quiz.pending_count} to grade
                </span>
              ) : null}
            </div>
            <button type="button" onClick={() => openResults(quiz)} className="btn-glass mt-4 w-full">
              View results
            </button>
          </article>
        ))}
      </div>

      {/* Create */}
      <Modal open={creating} onClose={() => setCreating(false)} title="New quiz" description="Students in the class can take it once." size="xl">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassSelect label="Class" value={classId} onChange={(event) => setClassId(event.target.value)} required>
              {classes.map((item) => (
                <option key={item.class_id} value={item.class_id}>
                  {item.subject_code} — {item.section_name}
                </option>
              ))}
            </GlassSelect>
            <GlassInput
              label="Deadline (optional)"
              type="datetime-local"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
            <div className="sm:col-span-2">
              <GlassInput label="Title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Quiz 1" required />
            </div>
            <div className="sm:col-span-2">
              <GlassTextarea
                label="Instructions (optional)"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div className="space-y-3">
            {questions.map((q, index) => (
              <div key={q.key} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-100">Question {index + 1}</p>
                  {questions.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setQuestions((previous) => previous.filter((item) => item.key !== q.key))}
                      aria-label={`Remove question ${index + 1}`}
                      className="text-gray-500 hover:text-red-300"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px]">
                  <GlassSelect
                    label="Type"
                    value={q.type}
                    onChange={(event) => patchQuestion(q.key, { type: event.target.value as QuestionType })}
                  >
                    {(Object.keys(TYPE_LABEL) as QuestionType[]).map((type) => (
                      <option key={type} value={type}>
                        {TYPE_LABEL[type]}
                      </option>
                    ))}
                  </GlassSelect>
                  <GlassInput
                    label="Points"
                    type="number"
                    min={0.5}
                    max={100}
                    step="0.5"
                    value={q.points}
                    onChange={(event) => patchQuestion(q.key, { points: event.target.value })}
                  />
                </div>

                <div className="mt-3">
                  <GlassTextarea
                    label="Question"
                    value={q.text}
                    onChange={(event) => patchQuestion(q.key, { text: event.target.value })}
                    rows={2}
                  />
                </div>

                {q.type === "multiple_choice" ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Options — select the correct one
                    </p>
                    {q.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${q.key}`}
                          checked={q.correctIndex === optionIndex}
                          onChange={() => patchQuestion(q.key, { correctIndex: optionIndex })}
                          aria-label={`Option ${optionIndex + 1} is correct`}
                          className="h-4 w-4 accent-rose-500"
                        />
                        <input
                          value={option}
                          onChange={(event) =>
                            patchQuestion(q.key, {
                              options: q.options.map((item, i) => (i === optionIndex ? event.target.value : item)),
                            })
                          }
                          placeholder={`Option ${optionIndex + 1}`}
                          className="input-glass"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                {q.type === "true_false" ? (
                  <div className="mt-3 max-w-xs">
                    <GlassSelect
                      label="Correct answer"
                      value={q.trueFalse}
                      onChange={(event) => patchQuestion(q.key, { trueFalse: event.target.value as "True" | "False" })}
                    >
                      <option value="True">True</option>
                      <option value="False">False</option>
                    </GlassSelect>
                  </div>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setQuestions((previous) => [...previous, newQuestion()])}
              disabled={questions.length >= 100}
              className="btn-glass w-full"
            >
              <Plus size={15} />
              Add question
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreating(false)} className="btn-glass">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-accent">
              {saving ? "Posting…" : "Post quiz"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Results */}
      <Modal
        open={detail !== null && grading === null}
        onClose={() => setDetail(null)}
        title={detail ? detail.quiz.title : "Results"}
        description={detail ? `${detail.questions.length} questions · ${detail.submissions.length} submitted` : undefined}
        size="lg"
      >
        {detail && detail.submissions.length > 0 ? (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                  <th className="px-3 py-2 font-semibold">Student</th>
                  <th className="px-3 py-2 font-semibold">Score</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {detail.submissions.map((submission) => (
                  <tr key={submission.submission_id} className="border-b border-white/10 last:border-b-0">
                    <td className="px-3 py-2">
                      <p className="text-gray-100">{submission.student_name}</p>
                      <p className="font-mono text-[11px] text-gray-500">{submission.student_number}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-200">{submission.total_score}</td>
                    <td className="px-3 py-2">
                      <span
                        className={clsx(
                          "badge",
                          submission.status === "Graded"
                            ? "border-green-400/30 bg-green-400/10 text-green-300"
                            : "border-amber-400/30 bg-amber-400/10 text-amber-300"
                        )}
                      >
                        {submission.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => openSubmission(submission.submission_id)} className="btn-glass text-xs">
                        {submission.status === "Graded" ? "Review" : "Grade"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">No one has submitted this quiz yet.</p>
        )}
      </Modal>

      {/* Grade one submission */}
      <Modal
        open={grading !== null}
        onClose={() => setGrading(null)}
        title="Grade submission"
        description="Multiple choice and true/false were graded automatically. Award points for short answers."
        size="lg"
      >
        {grading ? (
          <div className="space-y-3">
            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {grading.answers.map((answer, index) => (
                <div key={answer.answer_id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-gray-100">
                    {index + 1}. {answer.question_text}
                  </p>
                  <p className="mt-2 text-sm text-gray-300">
                    Answer: <span className="text-gray-100">{answer.student_answer || "(blank)"}</span>
                  </p>
                  {answer.type === "short_answer" ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-300">
                      Points
                      <input
                        type="number"
                        min={0}
                        max={answer.max_points}
                        step="0.5"
                        value={points[answer.answer_id] ?? "0"}
                        onChange={(event) => setPoints((previous) => ({ ...previous, [answer.answer_id]: event.target.value }))}
                        className="w-24 rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-accent/40"
                      />
                      <span className="text-gray-500">/ {answer.max_points}</span>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs">
                      <span className={answer.is_correct ? "text-green-400" : "text-red-400"}>
                        {answer.is_correct ? "Correct" : "Wrong"}
                      </span>
                      <span className="text-gray-500">
                        {" "}
                        · {answer.points_awarded} / {answer.max_points}
                        {!answer.is_correct && answer.correct_answer ? ` · Correct: ${answer.correct_answer}` : ""}
                      </span>
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setGrading(null)} className="btn-glass">
                Back
              </button>
              {grading.answers.some((answer) => answer.type === "short_answer") ? (
                <button type="button" onClick={saveGrade} disabled={savingGrade} className="btn-accent">
                  {savingGrade ? "Saving…" : "Save grade"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
