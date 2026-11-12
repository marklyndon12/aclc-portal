import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import LoadState from "../../components/LoadState";
import { api, ApiError } from "../../lib/api";
import { useStudentData } from "../../hooks/useStudentOverview";
import type { PublicQuestion } from "../../types";

interface QuizDetail {
  quiz: {
    quiz_id: string;
    title: string;
    instructions: string | null;
    deadline: string | null;
    subject_code: string;
    subject_name: string;
    max_score: number;
  };
  submission: { total_score: number; status: string; submitted_at: string } | null;
  closed: boolean;
  questions: PublicQuestion[];
}

export default function StudentQuizTake() {
  const { id = "" } = useParams();
  const { data, loading, error, refresh } = useStudentData<QuizDetail>(`/api/student/quizzes/${id}`);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const setAnswer = (questionId: string, value: string) =>
    setAnswers((previous) => ({ ...previous, [questionId]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;
    const unanswered = data.questions.filter((question) => !(answers[question.question_id] ?? "").trim());
    const message =
      unanswered.length > 0
        ? `You left ${unanswered.length} question(s) unanswered. Submit anyway? You can't change your answers afterwards.`
        : "Submit your answers? You can't change them afterwards.";
    if (!window.confirm(message)) return;

    setSubmitting(true);
    try {
      await api.post(`/api/student/quizzes/${id}/submit`, {
        answers: data.questions.map((question) => ({
          question_id: question.question_id,
          answer: answers[question.question_id] ?? "",
        })),
      });
      toast.success("Quiz submitted");
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not submit the quiz");
      void refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/student/quizzes" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200">
        <ArrowLeft size={15} />
        Back to quizzes
      </Link>

      <LoadState loading={loading} error={error} onRetry={refresh} />

      {data ? (
        <>
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
              {data.quiz.subject_code} · {data.quiz.subject_name}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-100">{data.quiz.title}</h1>
            {data.quiz.instructions ? (
              <p className="mt-2 max-w-2xl whitespace-pre-line text-sm text-gray-400">
                {data.quiz.instructions}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-gray-500">
              {data.quiz.max_score} points
              {data.quiz.deadline
                ? ` · Due ${new Date(data.quiz.deadline).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
                : ""}
            </p>
          </section>

          {data.submission ? (
            <div className="glass bg-white/10 p-6 text-center">
              <CheckCircle2 size={28} className="mx-auto text-green-400" />
              <p className="mt-3 text-sm text-gray-400">Your score</p>
              <p className="text-3xl font-bold text-gray-100">
                {data.submission.total_score} / {data.quiz.max_score}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                {data.submission.status === "Graded"
                  ? "Graded by your teacher."
                  : "Some answers still need your teacher's grading, so this score may go up."}
              </p>
            </div>
          ) : data.closed ? (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              This quiz is closed. The deadline has passed.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {data.questions.map((question, index) => (
                <fieldset key={question.question_id} className="glass bg-white/10 p-5">
                  <legend className="sr-only">Question {index + 1}</legend>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-100">
                      {index + 1}. {question.text}
                    </p>
                    <span className="badge shrink-0 border-white/15 bg-white/5 text-gray-400">
                      {question.points} pt{question.points === 1 ? "" : "s"}
                    </span>
                  </div>

                  {question.type === "short_answer" ? (
                    <textarea
                      value={answers[question.question_id] ?? ""}
                      onChange={(event) => setAnswer(question.question_id, event.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="Type your answer"
                      className="input-glass mt-3 resize-none"
                    />
                  ) : (
                    <div className="mt-3 space-y-2">
                      {(question.type === "true_false" ? ["True", "False"] : question.options).map((option) => {
                        const selected = answers[question.question_id] === option;
                        return (
                          <label
                            key={option}
                            className={clsx(
                              "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition",
                              selected
                                ? "border-accent/60 bg-accent/10 text-white"
                                : "border-white/15 bg-white/[0.04] text-gray-300 hover:border-white/25"
                            )}
                          >
                            <input
                              type="radio"
                              name={question.question_id}
                              value={option}
                              checked={selected}
                              onChange={() => setAnswer(question.question_id, option)}
                              className="h-4 w-4 accent-rose-500"
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              ))}

              <div className="flex justify-end">
                <button type="submit" disabled={submitting} className="btn-accent">
                  {submitting ? "Submitting…" : "Submit quiz"}
                </button>
              </div>
            </form>
          )}
        </>
      ) : null}
    </div>
  );
}
