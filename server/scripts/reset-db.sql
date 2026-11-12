BEGIN;

TRUNCATE TABLE
  public.student_answers,
  public.student_quiz_submissions,
  public.quiz_questions,
  public.quizzes,
  public.attendance,
  public.attendance_teachers,
  public.grades,
  public.classes,
  public.courses,
  public.students,
  public.teachers,
  public.subjects,
  public.sections,
  public.announcements,
  public.users
RESTART IDENTITY CASCADE;

COMMIT;
