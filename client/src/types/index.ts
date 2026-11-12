export type Role = "admin" | "teacher" | "student";

export interface StudentProfile {
  student_id: number;
  user_id: string;
  full_name: string;
  student_number: string;
  year_level: string | null;
  section: string | null;
  course_year: string | null;
}

export interface TeacherProfile {
  teacher_id: number;
  user_id: string;
  full_name: string;
  department: string | null;
  specialization: string | null;
}

export type Profile = StudentProfile | TeacherProfile;

export interface SessionUser {
  user_id: string;
  username: string;
  roles: Role;
  profile: Profile | null;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

export interface SignupPayload {
  full_name: string;
  username: string;
  role: Role;
  password: string;
  section?: string;
  department_id?: number;
  specialization?: string;
}

export interface SessionResponse {
  user: SessionUser;
}

// A class as shown on the teacher portal.
export interface TeacherClass {
  class_id: number;
  subject_code: string;
  subject_name: string;
  units: number;
  section_id: number;
  section_name: string;
  course_code: string;
  year_level: string;
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  enrolled: number;
}

export interface TeacherOverview {
  profile: {
    teacher_id: number;
    full_name: string;
    department: string | null;
    specialization: string;
  };
  classes: TeacherClass[];
  recent: { id: number; student_name: string; status: string; class_label: string }[];
}

export type StudentAttendanceStatus = "Present" | "Late" | "Absent" | "Excused";

export interface ClassAttendanceRow {
  student_id: number;
  student_number: string;
  full_name: string;
  status: StudentAttendanceStatus | null;
}

export interface ClassGradeRow {
  student_id: number;
  student_number: string;
  full_name: string;
  prelim: number | null;
  midterm: number | null;
  prefinal: number | null;
  final: number | null;
  gpa: number | null;
  remarks: string | null;
}

export interface TeacherLogRecord {
  id: number;
  date: string;
  status: TeacherAttendanceStatus;
  time_in: string | null;
  time_out: string | null;
}

export interface TeacherAnnouncement {
  announcement_id: number;
  title: string;
  body: string;
  audience: string;
  created_at: string;
  author_name: string | null;
}

// Course = a degree program such as BSIT or BSHM.
export interface Course {
  course_id: number;
  course_code: string;
  course_name: string;
  section_count: number;
  subject_count: number;
}

// Class = a subject given to a section, with a teacher and an optional schedule.
export interface ClassRow {
  class_id: number;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  section_id: number;
  section_name: string;
  course_code: string;
  year_level: string;
  teacher_id: number | null;
  teacher_name: string | null;
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  enrolled: number;
}

// ───────── Student portal ─────────

export interface StudentClass {
  class_id: number;
  subject_code: string;
  subject_name: string;
  units: number;
  teacher_name: string | null;
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
}

export interface StudentOverview {
  profile: {
    student_id: number;
    full_name: string;
    student_number: string;
    section: string;
    year_level: string;
    course_code: string | null;
  };
  classes: StudentClass[];
  recent_grades: {
    id: number;
    subject_code: string;
    subject_name: string;
    grade_value: number | null;
    gpa: number | null;
    remarks: string;
  }[];
}

export interface StudentGradeRow {
  class_id: number;
  subject_code: string;
  subject_name: string;
  units: number;
  teacher_name: string | null;
  prelim: number | null;
  midterm: number | null;
  prefinal: number | null;
  final: number | null;
  grade_value: number | null;
  gpa: number | null;
  remarks: string;
}

export interface StudentAttendanceSummary {
  class_id: number;
  subject_code: string;
  subject_name: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
  rate: number | null;
}

export interface StudentAttendanceRecord {
  id: number;
  date: string;
  status: string;
  subject_code: string;
  subject_name: string;
}

// ───────── Quizzes ─────────

export type QuestionType = "multiple_choice" | "true_false" | "short_answer";

export interface StudentQuizItem {
  quiz_id: string;
  title: string;
  instructions: string | null;
  deadline: string | null;
  subject_code: string;
  subject_name: string;
  question_count: number;
  max_score: number;
  status: "Open" | "Closed" | "Submitted" | "Graded";
  score: number | null;
  submitted_at: string | null;
}

export interface PublicQuestion {
  question_id: string;
  type: QuestionType;
  text: string;
  options: string[];
  points: number;
}

export interface TeacherQuizItem {
  quiz_id: string;
  title: string;
  deadline: string | null;
  created_at: string;
  class_id: number | null;
  subject_code: string;
  section_name: string;
  question_count: number;
  max_score: number;
  submission_count: number;
  pending_count: number;
}

export interface AdminUserRow {
  user_id: string;
  username: string;
  full_name: string;
  role: Role;
  status: "Active" | "Disabled" | "Pending" | "Rejected";
}

export interface SectionRow {
  section_id: number;
  section_name: string;
  course_id: number;
  course_code: string;
  year_level: string;
  student_count: number;
  class_count: number;
}

export interface ScanResult {
  student_name: string;
  status: string;
  time: string;
}

export interface AdminStudentRow {
  student_id: number;
  user_id: string;
  username: string;
  full_name: string;
  student_number: string;
  year_level: string;
  section: string;
  course_year: string;
  status: "Active" | "Disabled";
}

export interface AdminTeacherRow {
  teacher_id: number;
  user_id: string;
  username: string;
  full_name: string;
  department_id: number | null;
  department: string;
  specialization: string;
  status: "Active" | "Disabled";
}

export interface DepartmentRow {
  department_id: number;
  department_name: string;
  teacher_count: number;
}

export interface SubjectRow {
  subject_id: number;
  subject_code: string;
  subject_name: string;
  units: number;
  year_level: string;
  course_id: number | null;
  course_code: string | null;
}

export type TeacherAttendanceStatus = "Present" | "On Leave" | "Absent";

export interface TeacherAttendanceRecord {
  id: number;
  teacher_id: number;
  date: string;
  status: TeacherAttendanceStatus;
  time_in: string | null;
  time_out: string | null;
}

export type AnnouncementAudience = "Everyone" | "Students" | "Teachers";

export interface AnnouncementRow {
  announcement_id: number;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  created_at: string;
}
