ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS room text;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_course_date_uk
  ON public.attendance (student_id, course_id, attendance_date);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_teachers_teacher_date_uk
  ON public.attendance_teachers (teacher_id, date);

CREATE UNIQUE INDEX IF NOT EXISTS grades_student_course_uk
  ON public.grades (student_id, course_id);

CREATE UNIQUE INDEX IF NOT EXISTS courses_teacher_slot_uk
  ON public.courses (teacher_id, day, start_time) WHERE teacher_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS courses_section_slot_uk
  ON public.courses (section_name, day, start_time) WHERE section_name IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS courses_room_slot_uk
  ON public.courses (room, day, start_time) WHERE room IS NOT NULL;

CREATE INDEX IF NOT EXISTS classes_section_day_idx
  ON public.classes (section_id, day);
