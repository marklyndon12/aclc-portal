import { Link } from "react-router-dom";
import { Clock, FileQuestion } from "lucide-react";
import clsx from "clsx";
import LoadState from "../../components/LoadState";
import { useStudentData } from "../../hooks/useStudentOverview";
import type { StudentQuizItem } from "../../types";

const statusClass: Record<StudentQuizItem["status"], string> = {
  Open: "border-green-400/30 bg-green-400/10 text-green-300",
  Closed: "border-red-400/30 bg-red-400/10 text-red-300",
  Submitted: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  Graded: "border-sky-400/30 bg-sky-400/10 text-sky-300",
};

const statusLabel: Record<StudentQuizItem["status"], string> = {
  Open: "Open",
  Closed: "Closed",
  Submitted: "Waiting for grading",
  Graded: "Graded",
};

export default function StudentQuizzes() {
  const { data, loading, error, refresh } = useStudentData<{ quizzes: StudentQuizItem[] }>(
    "/api/student/quizzes"
  );
  const quizzes = data?.quizzes ?? [];

  return (
    <div className="space-y-6">
      <section>
        <span className="badge border-accent/40 bg-accent/15 text-accent">Assessments</span>
        <h1 className="mt-3 text-2xl font-bold text-gray-100">Quizzes</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Quizzes your teachers posted for your classes. You can submit each quiz once.
        </p>
      </section>

      <LoadState loading={loading} error={error} onRetry={refresh} />

      {!loading && !error && quizzes.length === 0 ? (
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
                  {quiz.subject_code}
                </p>
                <h2 className="mt-1 text-base font-semibold text-gray-100">{quiz.title}</h2>
              </div>
              <span className={clsx("badge shrink-0", statusClass[quiz.status])}>
                {statusLabel[quiz.status]}
              </span>
            </div>

            <p className="mt-2 text-xs text-gray-400">
              {quiz.question_count} question{quiz.question_count === 1 ? "" : "s"} · {quiz.max_score} points
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
              <Clock size={12} />
              {quiz.deadline
                ? `Due ${new Date(quiz.deadline).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
                : "No deadline"}
            </p>

            {quiz.score !== null ? (
              <p className="mt-3 text-sm text-gray-200">
                Score:{" "}
                <span className="font-bold text-gray-100">
                  {quiz.score} / {quiz.max_score}
                </span>
                {quiz.status === "Submitted" ? (
                  <span className="text-xs text-gray-500"> (so far)</span>
                ) : null}
              </p>
            ) : null}

            <Link
              to={`/student/quizzes/${quiz.quiz_id}`}
              className={clsx("mt-4 w-full justify-center", quiz.status === "Open" ? "btn-accent" : "btn-glass")}
            >
              {quiz.status === "Open" ? "Take quiz" : quiz.status === "Closed" ? "View" : "View result"}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
